/**
 * 룬 데이터 병합 스크립트
 * 수동 파싱된 모든 룬 데이터를 하나의 파일로 병합
 */

const fs = require('fs');
const path = require('path');

// 각 카테고리별 데이터 로드
const weaponRunes = require('./runes-manual.json').runes;
const armorRunes = require('./runes-armor.json');
const accessoryRunes = require('./runes-accessory.json');
const emblemRunes = require('./runes-emblem.json');

// ID 재정렬
let currentId = 1;

const allRunes = [];

// 무기 룬 (1~25)
weaponRunes.forEach(rune => {
  allRunes.push({ ...rune, id: currentId++ });
});

// 방어구 룬 (26~93)
armorRunes.forEach(rune => {
  allRunes.push({ ...rune, id: currentId++ });
});

// 장신구 룬 (94~254)
accessoryRunes.forEach(rune => {
  allRunes.push({ ...rune, id: currentId++ });
});

// 엠블럼 룬 (255~263)
emblemRunes.forEach(rune => {
  allRunes.push({ ...rune, id: currentId++ });
});

// 최종 데이터 구조
const finalData = {
  version: "2.0.0",
  lastUpdated: new Date().toISOString().split('T')[0],
  description: "수동 파싱된 룬 데이터 (시즌1 전설 + 신화)",
  stats: {
    totalRunes: allRunes.length,
    byCategory: {
      weapon: weaponRunes.length,
      armor: armorRunes.length,
      accessory: accessoryRunes.length,
      emblem: emblemRunes.length
    }
  },
  runes: allRunes
};

// 저장
fs.writeFileSync(
  path.join(__dirname, 'runes-final.json'),
  JSON.stringify(finalData, null, 2),
  'utf8'
);

console.log('=== 룬 데이터 병합 완료 ===');
console.log(`총 룬 개수: ${allRunes.length}개`);
console.log(`- 무기: ${weaponRunes.length}개`);
console.log(`- 방어구: ${armorRunes.length}개`);
console.log(`- 장신구: ${accessoryRunes.length}개`);
console.log(`- 엠블럼: ${emblemRunes.length}개`);
console.log('저장 위치: runes-final.json');

