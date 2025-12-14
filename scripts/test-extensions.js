const fs = require("fs");

const path = "C:\\Users\\dalko\\.cursor\\extensions\\extensions.json";

try {
  console.log("파일 읽기 시작...");
  const content = fs.readFileSync(path, "utf-8");
  console.log(`파일 크기: ${content.length} bytes`);

  const data = JSON.parse(content);
  const keys = Object.keys(data);
  console.log(`총 확장 프로그램 수: ${keys.length}`);

  // 처음 10개만 출력
  console.log("\n처음 10개 확장 프로그램:");
  keys.slice(0, 10).forEach((key, idx) => {
    const ext = data[key];
    console.log(`${idx + 1}. ${ext.name || "N/A"} (${key})`);
  });

  // 결과를 파일로 저장
  const output = `총 확장 프로그램 수: ${keys.length}\n\n`;
  fs.writeFileSync(
    "f:\\mobinogi\\calc-runes\\test-result.txt",
    output,
    "utf-8"
  );
  console.log("\n테스트 완료!");
} catch (error) {
  console.error("오류:", error.message);
  process.exit(1);
}



