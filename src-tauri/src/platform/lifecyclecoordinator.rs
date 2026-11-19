use std::path::Path;
#[cfg(unix)]
use std::path::PathBuf;
#[cfg(unix)]
use std::sync::{Mutex, OnceLock};

use crate::database;
use crate::error::AppError;

#[cfg(unix)]
static INSTANCE_SOCKET: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

#[cfg(unix)]
fn socket_path(folder: &Path) -> PathBuf {
    folder.join("instance.sock")
}

/// Attempts to focus an already-running instance via its Unix socket.
/// Removes stale socket files if connection is refused.
#[cfg(unix)]
pub fn try_focus_existing(folder: &Path) -> bool {
    use std::io::Write;
    use std::os::unix::net::UnixStream;

    let sock = socket_path(folder);
    match UnixStream::connect(&sock) {
        Ok(mut stream) => {
            let _ = stream.write_all(b"focus\n");
            true
        }
        Err(err) if err.kind() == std::io::ErrorKind::ConnectionRefused => {
            let _ = std::fs::remove_file(&sock);
            false
        }
        Err(_) => false,
    }
}

#[cfg(not(unix))]
pub fn try_focus_existing(_folder: &Path) -> bool {
    false
}

/// Starts a background Unix socket listener that invokes `on_focus` on incoming connections.
#[cfg(unix)]
pub fn start_instance_listener(
    folder: &Path,
    on_focus: impl Fn() + Send + 'static,
) -> std::io::Result<()> {
    use std::io::Read;
    use std::os::unix::fs::PermissionsExt;
    use std::os::unix::net::{UnixListener, UnixStream};

    std::fs::create_dir_all(folder)?;
    let sock = socket_path(folder);
    if sock.exists() {
        match UnixStream::connect(&sock) {
            Ok(_) => {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::AddrInUse,
                    "another instance is already listening",
                ));
            }
            Err(err) if err.kind() == std::io::ErrorKind::ConnectionRefused => {
                let _ = std::fs::remove_file(&sock);
            }
            Err(_) => {
                let _ = std::fs::remove_file(&sock);
            }
        }
    }

    let listener = UnixListener::bind(&sock)?;
    std::fs::set_permissions(&sock, std::fs::Permissions::from_mode(0o600))?;

    let slot = INSTANCE_SOCKET.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = slot.lock() {
        *guard = Some(sock);
    }

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(mut conn) => {
                    let mut buf = [0u8; 64];
                    let _ = conn.read(&mut buf);
                    on_focus();
                }
                Err(ref err) if err.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
    });

    Ok(())
}

#[cfg(not(unix))]
pub fn start_instance_listener(
    _folder: &Path,
    _on_focus: impl Fn() + Send + 'static,
) -> std::io::Result<()> {
    Ok(())
}

/// Opens and migrates the database at launch, dropping the connection before `manage_state`.
pub fn launch(folder: &Path) -> Result<(), AppError> {
    let connection = database::open(folder)?;
    drop(connection);
    Ok(())
}

/// Releases resources held by the application on exit.
pub fn exit() {
    #[cfg(unix)]
    if let Some(slot) = INSTANCE_SOCKET.get() {
        if let Ok(mut guard) = slot.lock() {
            if let Some(path) = guard.take() {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}
