#!/usr/bin/env python3
"""
CheckMateアプリケーションのバージョン更新スクリプト
全ての設定ファイルのバージョンを一括更新します。
"""

import json
import re
import sys
import os
from pathlib import Path
import argparse
import toml

def parse_version(version_str):
    """バージョン文字列をパース"""
    # v prefix を削除
    version_str = version_str.lstrip('v')

    # semver 形式かチェック
    if not re.match(r'^\d+\.\d+\.\d+$', version_str):
        raise ValueError(f"無効なバージョン形式: {version_str}")

    major, minor, patch = map(int, version_str.split('.'))
    return major, minor, patch

def increment_version(current_version, increment_type):
    """バージョンをインクリメント"""
    major, minor, patch = parse_version(current_version)

    if increment_type == 'patch':
        patch += 1
    elif increment_type == 'minor':
        minor += 1
        patch = 0
    elif increment_type == 'major':
        major += 1
        minor = 0
        patch = 0
    else:
        raise ValueError(f"無効なインクリメント方式: {increment_type}")

    return f"{major}.{minor}.{patch}"

def get_current_version():
    """package.jsonから現在のバージョンを取得"""
    try:
        with open('package.json', 'r', encoding='utf-8') as f:
            package_data = json.load(f)
            return package_data.get('version', '1.0.0')
    except FileNotFoundError:
        print("エラー: package.json が見つかりません")
        return '1.0.0'

def update_package_json(version):
    """package.json を更新"""
    try:
        with open('package.json', 'r', encoding='utf-8') as f:
            data = json.load(f)

        data['version'] = version

        with open('package.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"OK package.json を v{version} に更新")
        return True
    except Exception as e:
        print(f"NG package.json の更新に失敗: {e}")
        return False

def update_package_lock_json(version):
    """package-lock.json を更新"""
    try:
        if not os.path.exists('package-lock.json'):
            print("! package-lock.json が存在しません（スキップ）")
            return True

        with open('package-lock.json', 'r', encoding='utf-8') as f:
            data = json.load(f)

        data['version'] = version
        if 'packages' in data and '' in data['packages']:
            data['packages']['']['version'] = version

        with open('package-lock.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"OK package-lock.json を v{version} に更新")
        return True
    except Exception as e:
        print(f"NG package-lock.json の更新に失敗: {e}")
        return False

def update_cargo_toml(version):
    """Cargo.toml を更新"""
    cargo_path = Path('src-tauri/Cargo.toml')
    try:
        if not cargo_path.exists():
            print("! src-tauri/Cargo.toml が存在しません（スキップ）")
            return True

        with open(cargo_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # version = "x.x.x" の行を更新
        updated_content = re.sub(
            r'^version\s*=\s*"[^"]*"',
            f'version = "{version}"',
            content,
            flags=re.MULTILINE
        )

        with open(cargo_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)

        print(f"OK src-tauri/Cargo.toml を v{version} に更新")
        return True
    except Exception as e:
        print(f"NG src-tauri/Cargo.toml の更新に失敗: {e}")
        return False

def update_cargo_lock(version):
    """Cargo.lock を更新"""
    cargo_lock_path = Path('src-tauri/Cargo.lock')
    try:
        if not cargo_lock_path.exists():
            print("! src-tauri/Cargo.lock が存在しません（スキップ）")
            return True

        with open(cargo_lock_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # checkmate パッケージの version を更新
        updated_content = re.sub(
            r'(name = "checkmate"[\s\S]*?)version = "[^"]*"',
            rf'\1version = "{version}"',
            content
        )

        with open(cargo_lock_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)

        print(f"OK src-tauri/Cargo.lock を v{version} に更新")
        return True
    except Exception as e:
        print(f"NG src-tauri/Cargo.lock の更新に失敗: {e}")
        return False

def update_tauri_conf_json(version):
    """tauri.conf.json を更新"""
    tauri_conf_path = Path('src-tauri/tauri.conf.json')
    try:
        if not tauri_conf_path.exists():
            print("! src-tauri/tauri.conf.json が存在しません（スキップ）")
            return True

        with open(tauri_conf_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if 'package' in data:
            data['package']['version'] = version

        with open(tauri_conf_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"OK src-tauri/tauri.conf.json を v{version} に更新")
        return True
    except Exception as e:
        print(f"NG src-tauri/tauri.conf.json の更新に失敗: {e}")
        return False

def main():
    # プロジェクトルートにいるかチェック
    if not os.path.exists('package.json'):
        print("エラー: プロジェクトのルートディレクトリで実行してください")
        sys.exit(1)

    parser = argparse.ArgumentParser(description='CheckMateのバージョンを更新')
    parser.add_argument('version', nargs='?', help='新しいバージョン (例: 1.2.0)')
    parser.add_argument('--increment', choices=['patch', 'minor', 'major'],
                       help='バージョンのインクリメント方式')

    args = parser.parse_args()

    try:
        if args.version:
            # 直接バージョン指定
            new_version = args.version.lstrip('v')
            parse_version(new_version)  # バリデーション
        elif args.increment:
            # インクリメント指定
            current_version = get_current_version()
            new_version = increment_version(current_version, args.increment)
            print(f"現在のバージョン: v{current_version}")
        else:
            # 引数なしの場合はパッチバージョンアップ
            current_version = get_current_version()
            new_version = increment_version(current_version, 'patch')
            print(f"現在のバージョン: v{current_version}")

        print(f"新しいバージョン: v{new_version}")
        print("-" * 50)

        # 全ファイル更新
        success_count = 0
        success_count += update_package_json(new_version)
        success_count += update_package_lock_json(new_version)
        success_count += update_cargo_toml(new_version)
        success_count += update_cargo_lock(new_version)
        success_count += update_tauri_conf_json(new_version)

        print("-" * 50)

        if success_count == 5:
            print(f"SUCCESS すべてのファイルを v{new_version} に更新しました")
            print("\n次のステップ:")
            print("1. 変更内容を確認: git diff")
            print("2. アプリケーションをテスト: npm run tauri dev")
            print(f"3. 変更をコミット: git commit -am \"update: v{new_version}にアップデート\"")
            print(f"4. タグを作成: git tag v{new_version}")
            print("5. プッシュ: git push origin main --tags")
        else:
            print(f"WARNING 一部のファイルの更新に失敗しました ({success_count}/5)")
            sys.exit(1)

    except ValueError as e:
        print(f"エラー: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"予期しないエラー: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()