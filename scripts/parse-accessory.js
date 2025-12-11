/**
 * 장신구 룬 간략 파싱 스크립트
 * 스킬 변경 룬으로 분류하여 DPS 효율 계산에서 제외
 * 정확한 클래스명으로 매칭 (계열 아님)
 */

const fs = require('fs');
const path = require('path');

// 원본 데이터 로드
const runesData = require('./runes-parsed.json');
const accessories = runesData.runes.filter(r => r.category === '03');

// 정확한 클래스명 패턴 (계열이 아닌 개별 클래스)
// 주의: 더 구체적인 패턴이 먼저 와야 함 (대검전사 → 전사)
const CLASS_PATTERNS = [
  // 전사계열 (대검전사, 검술사가 전사보다 먼저)
  { pattern: /대검전사의/, class: '대검전사' },
  { pattern: /검술사의/, class: '검술사' },
  { pattern: /전사의/, class: '전사' },
  // 궁수계열 (석궁사수, 장궁병이 궁수보다 먼저)
  { pattern: /석궁사수의/, class: '석궁사수' },
  { pattern: /장궁병의/, class: '장궁병' },
  { pattern: /궁수의/, class: '궁수' },
  // 힐러계열 (사제, 수도사, 암흑술사가 힐러보다 먼저)
  { pattern: /암흑술사의/, class: '암흑술사' },
  { pattern: /사제의/, class: '사제' },
  { pattern: /수도사의/, class: '수도사' },
  { pattern: /힐러의/, class: '힐러' },
  // 마법사계열 (화염/빙결/전격술사가 마법사보다 먼저)
  { pattern: /화염술사의/, class: '화염술사' },
  { pattern: /빙결술사의/, class: '빙결술사' },
  { pattern: /전격술사의/, class: '전격술사' },
  { pattern: /마법사의/, class: '마법사' },
  // 도적계열 (듀얼블레이드, 격투가가 도적보다 먼저)
  { pattern: /듀얼블레이드의/, class: '듀얼블레이드' },
  { pattern: /격투가의/, class: '격투가' },
  { pattern: /도적의/, class: '도적' },
  // 음유시인계열 (댄서, 악사가 음유시인보다 먼저)
  { pattern: /댄서의/, class: '댄서' },
  { pattern: /악사의/, class: '악사' },
  { pattern: /음유시인의/, class: '음유시인' }
];

function getClassRestriction(desc) {
  for (const { pattern, class: cls } of CLASS_PATTERNS) {
    if (pattern.test(desc)) {
      return cls;
    }
  }
  return null;
}

// 장신구 룬 간략 파싱
const parsedAccessories = accessories.map((r, i) => {
  const desc = r.rawDescription.replace(/<[^>]+>/g, '').replace(/\n/g, ' ');
  const classRestriction = getClassRestriction(desc);
  
  return {
    id: 94 + i,
    name: r.name,
    category: '03',
    categoryName: '장신구',
    gradeName: r.gradeName,
    gradeColor: r.gradeColor,
    type: 'SKILL_CHANGE',
    effects: [],
    demerits: [],
    enhanceEffects: { "10": {}, "15": {} },
    synergy: {
      appliesDot: [],
      requiresDot: [],
      removesDemerits: false
    },
    classRestriction: classRestriction,
    dpsRelevant: false,
    rawDescription: desc.substring(0, 150) + (desc.length > 150 ? '...' : '')
  };
});

// 결과 저장
fs.writeFileSync(
  path.join(__dirname, 'runes-accessory.json'),
  JSON.stringify(parsedAccessories, null, 2),
  'utf8'
);

console.log(`장신구 룬 ${parsedAccessories.length}개 간략 파싱 완료!`);
console.log('저장 위치: runes-accessory.json');

// 클래스별 통계 출력
const classStats = {};
parsedAccessories.forEach(r => {
  const cls = r.classRestriction || '미분류';
  classStats[cls] = (classStats[cls] || 0) + 1;
});
console.log('\n클래스별 룬 개수:');
Object.entries(classStats).sort((a, b) => b[1] - a[1]).forEach(([cls, count]) => {
  console.log(`  ${cls}: ${count}개`);
});
