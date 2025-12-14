# -*- coding: utf-8 -*-
"""
Cursor 확장 프로그램 분석 스크립트
작성일: 2025-01-27
"""

import json
import os
from datetime import datetime

extensions_json_path = r"C:\Users\dalko\.cursor\extensions\extensions.json"
output_path = r"f:\mobinogi\calc-runes\cursor-extensions-list.txt"
analysis_path = r"f:\mobinogi\calc-runes\extension-analysis.txt"

try:
    print("확장 프로그램 파일 읽는 중...")
    print(f"파일 경로: {extensions_json_path}")

    if not os.path.exists(extensions_json_path):
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {extensions_json_path}")

    with open(extensions_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"파일 크기: {os.path.getsize(extensions_json_path)} bytes")
    print("JSON 파싱 성공")

    extensions = []
    for key, value in data.items():
        if isinstance(value, dict):
            extensions.append(
                {
                    "id": key,
                    "name": value.get("name", "N/A"),
                    "publisher": value.get("publisher", "N/A"),
                    "version": value.get("version", "N/A"),
                    "enabled": value.get("enabled", True),
                }
            )

    # 이름 순으로 정렬
    extensions.sort(key=lambda x: x["name"])

    print(f"\n총 확장 프로그램 수: {len(extensions)}")

    # 파일로 저장
    output = f"Cursor 확장 프로그램 목록\n"
    output += f"생성일: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    output += f"총 확장 프로그램 수: {len(extensions)}\n\n"
    output += "=" * 100 + "\n"
    output += f"{'번호':<6} {'ID':<50} {'이름':<35} {'게시자':<20} {'버전':<15} {'상태':<10}\n"
    output += "=" * 100 + "\n"

    for idx, ext in enumerate(extensions, 1):
        status = "활성화" if ext["enabled"] else "비활성화"
        ext_id = ext["id"][:47] + "..." if len(ext["id"]) > 50 else ext["id"]
        name = ext["name"][:32] + "..." if len(ext["name"]) > 35 else ext["name"]
        output += f"{idx:<6} {ext_id:<50} {name:<35} {ext['publisher']:<20} {ext['version']:<15} {status:<10}\n"

    # 카테고리별 분류
    output += "\n\n" + "=" * 100 + "\n"
    output += "카테고리별 분류\n"
    output += "=" * 100 + "\n\n"

    language_exts = [
        e
        for e in extensions
        if "language" in e["id"].lower()
        or "language" in e["name"].lower()
        or "syntax" in e["id"].lower()
    ]
    theme_exts = [
        e
        for e in extensions
        if "theme" in e["id"].lower() or "theme" in e["name"].lower()
    ]
    git_exts = [
        e for e in extensions if "git" in e["id"].lower() or "git" in e["name"].lower()
    ]
    debug_exts = [
        e
        for e in extensions
        if "debug" in e["id"].lower() or "debug" in e["name"].lower()
    ]
    format_exts = [
        e
        for e in extensions
        if any(
            x in e["id"].lower() for x in ["formatter", "linter", "prettier", "eslint"]
        )
    ]

    output += f"언어 관련: {len(language_exts)}개\n"
    output += f"테마 관련: {len(theme_exts)}개\n"
    output += f"Git 관련: {len(git_exts)}개\n"
    output += f"디버깅 관련: {len(debug_exts)}개\n"
    output += f"포맷팅/린팅 관련: {len(format_exts)}개\n"
    other_count = (
        len(extensions)
        - len(language_exts)
        - len(theme_exts)
        - len(git_exts)
        - len(debug_exts)
        - len(format_exts)
    )
    output += f"기타: {other_count}개\n"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output)

    print(f"\n목록이 다음 파일에 저장되었습니다:\n{output_path}")
    print(f"파일 크기: {len(output)} bytes")

    # 불필요한 확장 프로그램 분석
    analysis = "\n\n" + "=" * 100 + "\n"
    analysis += "불필요한 확장 프로그램 분석\n"
    analysis += "=" * 100 + "\n"

    # 비활성화된 확장 프로그램
    disabled_exts = [e for e in extensions if not e["enabled"]]
    analysis += f"\n1. 비활성화된 확장 프로그램: {len(disabled_exts)}개\n"
    if disabled_exts:
        for idx, ext in enumerate(disabled_exts, 1):
            analysis += f"   {idx}. {ext['name']} ({ext['id']})\n"
        analysis += "   → 제거 권장: 비활성화된 확장 프로그램은 제거해도 됩니다.\n"
    else:
        analysis += "   → 모든 확장 프로그램이 활성화되어 있습니다.\n"

    # 중복 가능성 있는 확장 프로그램
    name_groups = {}
    for ext in extensions:
        key = ext["name"].lower().replace(" ", "")
        if key not in name_groups:
            name_groups[key] = []
        name_groups[key].append(ext)

    duplicates = [g for g in name_groups.values() if len(g) > 1]
    analysis += f"\n2. 중복 가능성 있는 확장 프로그램: {len(duplicates)}개 그룹\n"
    if duplicates:
        for idx, group in enumerate(duplicates, 1):
            analysis += f"   그룹 {idx}: {group[0]['name']} ({len(group)}개 버전)\n"
            for ext in group:
                status = "[활성화]" if ext["enabled"] else "[비활성화]"
                analysis += f"     - {ext['id']} ({ext['publisher']}, v{ext['version']}) {status}\n"
            analysis += "   → 하나만 유지하고 나머지는 제거 권장\n"
    else:
        analysis += "   → 중복된 확장 프로그램이 없습니다.\n"

    # 테마 확장 프로그램
    analysis += f"\n3. 테마 확장 프로그램: {len(theme_exts)}개\n"
    if len(theme_exts) > 3:
        analysis += (
            "   → 테마가 많습니다. 자주 사용하지 않는 테마는 제거를 고려해보세요.\n"
        )
        for idx, ext in enumerate(theme_exts, 1):
            analysis += f"   {idx}. {ext['name']} ({ext['id']})\n"
    else:
        analysis += "   → 적절한 수준입니다.\n"

    # 언어 확장 프로그램
    analysis += f"\n4. 언어 확장 프로그램: {len(language_exts)}개\n"
    if len(language_exts) > 10:
        analysis += "   → 언어 확장 프로그램이 많습니다. 사용하지 않는 언어는 제거를 고려해보세요.\n"
    else:
        analysis += "   → 적절한 수준입니다.\n"

    # 포맷팅/린팅 관련
    analysis += f"\n5. 포맷팅/린팅 관련: {len(format_exts)}개\n"
    if len(format_exts) > 5:
        analysis += "   → 포맷터/린터가 많습니다. 중복 기능이 있는지 확인해보세요.\n"
        for idx, ext in enumerate(format_exts, 1):
            analysis += f"   {idx}. {ext['name']} ({ext['id']})\n"

    # Git 관련
    analysis += f"\n6. Git 관련: {len(git_exts)}개\n"
    if len(git_exts) > 3:
        analysis += (
            "   → Git 확장 프로그램이 많습니다. 중복 기능이 있는지 확인해보세요.\n"
        )

    # 디버깅 관련
    analysis += f"\n7. 디버깅 관련: {len(debug_exts)}개\n"

    # 전체 요약
    analysis += "\n" + "=" * 100 + "\n"
    analysis += "정리 권장 사항\n"
    analysis += "=" * 100 + "\n"

    recommended_removals = 0
    if disabled_exts:
        recommended_removals += len(disabled_exts)
        analysis += f"- 비활성화된 확장 프로그램 {len(disabled_exts)}개 제거 권장\n"

    for group in duplicates:
        if len(group) > 1:
            recommended_removals += len(group) - 1

    if recommended_removals > 0:
        analysis += (
            f"- 총 {recommended_removals}개 정도의 확장 프로그램 제거를 고려해보세요.\n"
        )
    else:
        analysis += "- 현재 설치된 확장 프로그램이 적절하게 관리되고 있습니다.\n"

    analysis += f"\n현재 총 {len(extensions)}개 중 {len(extensions) - recommended_removals}개 유지 권장\n"

    with open(analysis_path, "w", encoding="utf-8") as f:
        f.write(analysis)

    print(analysis)
    print(f"\n분석 결과가 다음 파일에 저장되었습니다:\n{analysis_path}")

except Exception as e:
    error_msg = f"오류 발생: {e}\n"
    import traceback

    error_msg += traceback.format_exc()
    print(error_msg)
    # 에러도 파일로 저장
    try:
        with open(
            r"f:\mobinogi\calc-runes\extension-error.txt", "w", encoding="utf-8"
        ) as f:
            f.write(error_msg)
    except:
        pass
    exit(1)



