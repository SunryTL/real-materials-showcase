from __future__ import annotations

import argparse
import getpass

from .config import Settings
from .database import connect, init_database
from .security import hash_password, utc_now


def create_user(settings: Settings, username: str, display_name: str, role: str) -> None:
    settings.prepare()
    init_database(settings.database_path)
    password = getpass.getpass("请输入新账号密码：")
    confirm = getpass.getpass("请再次输入密码：")
    if password != confirm or len(password) < 12:
        raise SystemExit("两次密码不一致，或密码少于12位")
    with connect(settings.database_path) as connection:
        connection.execute(
            "INSERT INTO users(username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?)",
            (username, display_name, hash_password(password), role, utc_now()),
        )
    print(f"已创建{role}账号：{username}")


def main() -> None:
    parser = argparse.ArgumentParser(description="REAL私有工作台管理命令")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-user")
    create.add_argument("--username", required=True)
    create.add_argument("--display-name", required=True)
    create.add_argument("--role", choices=("owner", "contributor"), default="contributor")
    args = parser.parse_args()
    if args.command == "create-user":
        create_user(Settings.from_env(), args.username, args.display_name, args.role)


if __name__ == "__main__":
    main()
