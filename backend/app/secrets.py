"""Keys never leave the backend. Back up the local encryption key with the database."""
import os

from cryptography.fernet import Fernet

from .store import data_dir


def cipher() -> Fernet:
    configured = os.environ.get("CHAT_ENCRYPTION_KEY")
    if configured:
        return Fernet(configured.encode())
    path = data_dir() / "secret.key"
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(fd, "wb") as file:
            file.write(Fernet.generate_key())
    return Fernet(path.read_bytes())


def encrypt(value: str) -> str:
    return cipher().encrypt(value.encode()).decode() if value else ""


def decrypt(value: str) -> str:
    return cipher().decrypt(value.encode()).decode() if value else ""


def public_provider(item):
    return {**{key: value for key, value in item.items() if key != "secret"},
            "has_key": bool(item.get("secret"))}
