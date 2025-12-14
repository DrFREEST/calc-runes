/**
 * Cursor 확장 프로그램 목록 추출 스크립트
 * 작성일: 2025-01-27
 * 목적: extensions.json 파일을 파싱하여 설치된 확장 프로그램 목록을 출력
 */

const fs = require("fs");
const path = require("path");

const extensionsJsonPath =
  "C:\\Users\\dalko\\.cursor\\extensions\\extensions.json";
const outputPath = path.join(__dirname, "..", "cursor-extensions-list.txt");
const analysisPath = path.join(__dirname, "..", "extension-analysis.txt");

try {
  console.log("확장 프로그램 파일 읽는 중...");
  console.log(`파일 경로: ${extensionsJsonPath}`);

  if (!fs.existsSync(extensionsJsonPath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${extensionsJsonPath}`);
  }

  const fileContent = fs.readFileSync(extensionsJsonPath, "utf-8");
  console.log(`파일 크기: ${fileContent.length} bytes`);

  const data = JSON.parse(fileContent);
  console.log("JSON 파싱 성공");

  console.log("JSON 파싱 완료. 확장 프로그램 정보 추출 중...");

  const extensions = [];

  if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "object" && value !== null) {
        extensions.push({
          id: key,
          name: value.name || "N/A",
          publisher: value.publisher || "N/A",
          version: value.version || "N/A",
          enabled: value.enabled !== false,
        });
      }
    }
  }

  // 정렬: 이름 순
  extensions.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\n총 확장 프로그램 수: ${extensions.length}\n`);
  console.log("=".repeat(100));
  console.log(
    `${"번호".padEnd(6)} ${"ID".padEnd(50)} ${"이름".padEnd(
      35
    )} ${"게시자".padEnd(20)} ${"버전".padEnd(15)} ${"상태".padEnd(10)}`
  );
  console.log("=".repeat(100));

  extensions.forEach((ext, idx) => {
    const status = ext.enabled ? "활성화" : "비활성화";
    const id = ext.id.length > 50 ? ext.id.substring(0, 47) + "..." : ext.id;
    const name =
      ext.name.length > 35 ? ext.name.substring(0, 32) + "..." : ext.name;
    console.log(
      `${String(idx + 1).padEnd(6)} ${id.padEnd(50)} ${name.padEnd(
        35
      )} ${ext.publisher.padEnd(20)} ${ext.version.padEnd(15)} ${status.padEnd(
        10
      )}`
    );
  });

  // 파일로 저장
  let output = `Cursor 확장 프로그램 목록\n`;
  output += `생성일: ${new Date().toLocaleString("ko-KR")}\n`;
  output += `총 확장 프로그램 수: ${extensions.length}\n\n`;
  output += "=".repeat(100) + "\n";
  output += `${"번호".padEnd(6)} ${"ID".padEnd(50)} ${"이름".padEnd(
    35
  )} ${"게시자".padEnd(20)} ${"버전".padEnd(15)} ${"상태".padEnd(10)}\n`;
  output += "=".repeat(100) + "\n";

  extensions.forEach((ext, idx) => {
    const status = ext.enabled ? "활성화" : "비활성화";
    const id = ext.id.length > 50 ? ext.id.substring(0, 47) + "..." : ext.id;
    const name =
      ext.name.length > 35 ? ext.name.substring(0, 32) + "..." : ext.name;
    output += `${String(idx + 1).padEnd(6)} ${id.padEnd(50)} ${name.padEnd(
      35
    )} ${ext.publisher.padEnd(20)} ${ext.version.padEnd(15)} ${status.padEnd(
      10
    )}\n`;
  });

  // 카테고리별 분류
  output += "\n\n" + "=".repeat(100) + "\n";
  output += "카테고리별 분류\n";
  output += "=".repeat(100) + "\n\n";

  // 언어 관련
  const languageExts = extensions.filter(
    (ext) =>
      ext.id.includes("language") ||
      ext.name.toLowerCase().includes("language") ||
      ext.id.includes("syntax")
  );

  // 테마 관련
  const themeExts = extensions.filter(
    (ext) =>
      ext.id.includes("theme") || ext.name.toLowerCase().includes("theme")
  );

  // Git 관련
  const gitExts = extensions.filter(
    (ext) => ext.id.includes("git") || ext.name.toLowerCase().includes("git")
  );

  // 디버깅 관련
  const debugExts = extensions.filter(
    (ext) =>
      ext.id.includes("debug") || ext.name.toLowerCase().includes("debug")
  );

  // 포맷팅/린팅 관련
  const formatExts = extensions.filter(
    (ext) =>
      ext.id.includes("formatter") ||
      ext.id.includes("linter") ||
      ext.id.includes("prettier") ||
      ext.id.includes("eslint")
  );

  output += `언어 관련: ${languageExts.length}개\n`;
  output += `테마 관련: ${themeExts.length}개\n`;
  output += `Git 관련: ${gitExts.length}개\n`;
  output += `디버깅 관련: ${debugExts.length}개\n`;
  output += `포맷팅/린팅 관련: ${formatExts.length}개\n`;
  output += `기타: ${
    extensions.length -
    languageExts.length -
    themeExts.length -
    gitExts.length -
    debugExts.length -
    formatExts.length
  }개\n`;

  fs.writeFileSync(outputPath, output, "utf-8");
  console.log(`\n\n목록이 다음 파일에 저장되었습니다:\n${outputPath}`);

  // 불필요한 확장 프로그램 분석
  let analysis = "\n\n" + "=".repeat(100) + "\n";
  analysis += "불필요한 확장 프로그램 분석\n";
  analysis += "=".repeat(100) + "\n";

  // 비활성화된 확장 프로그램
  const disabledExts = extensions.filter((ext) => !ext.enabled);
  analysis += `\n1. 비활성화된 확장 프로그램: ${disabledExts.length}개\n`;
  if (disabledExts.length > 0) {
    disabledExts.forEach((ext, idx) => {
      analysis += `   ${idx + 1}. ${ext.name} (${ext.id})\n`;
    });
    analysis += `   → 제거 권장: 비활성화된 확장 프로그램은 제거해도 됩니다.\n`;
  } else {
    analysis += `   → 모든 확장 프로그램이 활성화되어 있습니다.\n`;
  }

  // 중복 가능성 있는 확장 프로그램 (같은 기능)
  const nameGroups = {};
  extensions.forEach((ext) => {
    const key = ext.name.toLowerCase().replace(/\s+/g, "");
    if (!nameGroups[key]) {
      nameGroups[key] = [];
    }
    nameGroups[key].push(ext);
  });

  const duplicates = Object.values(nameGroups).filter(
    (group) => group.length > 1
  );
  analysis += `\n2. 중복 가능성 있는 확장 프로그램: ${duplicates.length}개 그룹\n`;
  if (duplicates.length > 0) {
    duplicates.forEach((group, idx) => {
      analysis += `   그룹 ${idx + 1}: ${group[0].name} (${
        group.length
      }개 버전)\n`;
      group.forEach((ext) => {
        analysis += `     - ${ext.id} (${ext.publisher}, v${ext.version}) ${
          ext.enabled ? "[활성화]" : "[비활성화]"
        }\n`;
      });
      analysis += `   → 하나만 유지하고 나머지는 제거 권장\n`;
    });
  } else {
    analysis += `   → 중복된 확장 프로그램이 없습니다.\n`;
  }

  // 테마 확장 프로그램 (여러 개 설치된 경우)
  analysis += `\n3. 테마 확장 프로그램: ${themeExts.length}개\n`;
  if (themeExts.length > 3) {
    analysis += `   → 테마가 많습니다. 자주 사용하지 않는 테마는 제거를 고려해보세요.\n`;
    themeExts.forEach((ext, idx) => {
      analysis += `   ${idx + 1}. ${ext.name} (${ext.id})\n`;
    });
  } else {
    analysis += `   → 적절한 수준입니다.\n`;
  }

  // 언어 확장 프로그램 (사용하지 않는 언어)
  analysis += `\n4. 언어 확장 프로그램: ${languageExts.length}개\n`;
  if (languageExts.length > 10) {
    analysis += `   → 언어 확장 프로그램이 많습니다. 사용하지 않는 언어는 제거를 고려해보세요.\n`;
  } else {
    analysis += `   → 적절한 수준입니다.\n`;
  }

  // 포맷팅/린팅 관련 (중복 가능성)
  analysis += `\n5. 포맷팅/린팅 관련: ${formatExts.length}개\n`;
  if (formatExts.length > 5) {
    analysis += `   → 포맷터/린터가 많습니다. 중복 기능이 있는지 확인해보세요.\n`;
    formatExts.forEach((ext, idx) => {
      analysis += `   ${idx + 1}. ${ext.name} (${ext.id})\n`;
    });
  }

  // Git 관련
  analysis += `\n6. Git 관련: ${gitExts.length}개\n`;
  if (gitExts.length > 3) {
    analysis += `   → Git 확장 프로그램이 많습니다. 중복 기능이 있는지 확인해보세요.\n`;
  }

  // 디버깅 관련
  analysis += `\n7. 디버깅 관련: ${debugExts.length}개\n`;

  // 전체 요약
  analysis += `\n` + "=".repeat(100) + "\n";
  analysis += "정리 권장 사항\n";
  analysis += "=".repeat(100) + "\n";

  let recommendedRemovals = 0;
  if (disabledExts.length > 0) {
    recommendedRemovals += disabledExts.length;
    analysis += `- 비활성화된 확장 프로그램 ${disabledExts.length}개 제거 권장\n`;
  }

  duplicates.forEach((group) => {
    if (group.length > 1) {
      recommendedRemovals += group.length - 1;
    }
  });

  if (recommendedRemovals > 0) {
    analysis += `- 총 ${recommendedRemovals}개 정도의 확장 프로그램 제거를 고려해보세요.\n`;
  } else {
    analysis += `- 현재 설치된 확장 프로그램이 적절하게 관리되고 있습니다.\n`;
  }

  analysis += `\n현재 총 ${extensions.length}개 중 ${
    extensions.length - recommendedRemovals
  }개 유지 권장\n`;

  // 분석 결과를 파일에 추가 저장
  fs.writeFileSync(analysisPath, analysis, "utf-8");
  console.log(analysis);
  console.log(`\n분석 결과가 다음 파일에 저장되었습니다:\n${analysisPath}`);
} catch (error) {
  const errorMsg = `오류 발생: ${error.message}\n${error.stack}`;
  console.error(errorMsg);
  try {
    fs.writeFileSync(errorLogPath, errorMsg, "utf-8");
  } catch (e) {
    // 에러 로그 파일 쓰기 실패 시 무시
  }
  process.exit(1);
}



