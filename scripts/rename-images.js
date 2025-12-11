/**
 * 룬 이미지 파일명 변경 스크립트
 * @description 해시값 파일명을 의미있는 이름으로 변경
 * @created 2025-12-10
 */

const fs = require('fs');
const path = require('path');

// 파일명 매핑 (해시값 → 의미있는 이름)
// 카테고리: 01=무기, 02=방어구, 03=장신구, 04=엠블럼
const FILE_NAME_MAP = {
    // 공통 (모든 카테고리에서 사용)
    'b8c37e33.png': 'rune_common.png',
    
    // 무기 룬 (카테고리 01)
    '1587965f.png': 'weapon_fury.png',        // 눈 먼 분노, 옛 검투사
    'aa68c75c.png': 'weapon_frost.png',       // 천 자루 검, 냉혹한 겨울
    'fba9d881.png': 'weapon_magic.png',       // 마법 탐구가, 살아있는 번갯불
    'd7322ed7.png': 'weapon_duel.png',        // 결투, 차오르는 안개
    '2387337b.png': 'weapon_thorn.png',       // 가시 덩굴, 뒤틀린 칼날
    'fed33392.png': 'weapon_flame.png',       // 타오르는 불씨, 극독
    '9246444d.png': 'weapon_ice.png',         // 빙결, 사자
    
    // 방어구 룬 (카테고리 02)
    'd7a84628.png': 'armor_poison.png',       // 독 안개, 흡혈
    '4ba29b9f.png': 'armor_storm.png',        // 폭풍, 전율하는 악상
    'a00e5eb0.png': 'armor_erosion.png',      // 침식, 검은 서약
    'a5910243.png': 'armor_silver.png',       // 은빛 첨탑, 방호
    'ea5a486c.png': 'armor_blade.png',        // 칼날 보루, 저격
    'd47268e9.png': 'armor_wind.png',         // 고요한 바람, 평원 방랑자
    'f1981e4b.png': 'armor_life.png',         // 생명, 붉은 맹약
    'd0fb963f.png': 'armor_brawl.png',        // 난투, 생존 본능
    'ee16fa83.png': 'armor_doom.png',         // 파멸의 낙인, 굶주린 칼날
    'ef8446f3.png': 'armor_mana.png',         // 응축된 마력, 깨달음
    'b8b4b727.png': 'armor_vitality.png',     // 끝없는 활력
    
    // 장신구 룬 (카테고리 03)
    'f8eb278a.png': 'accessory_common.png',   // 매, 희생, 흉성 (214개)
    '1008.png': 'accessory_barrier.png',      // 역장
    '3009.png': 'accessory_discharge.png',    // 방전
    'cb5f9844.png': 'accessory_fortune.png',  // 점괘, 격분
    'ffc58105.png': 'accessory_stealth.png',  // 암습
    '671d8d05.png': 'accessory_relief.png',   // 안도, 경감
    'ab8df9f7.png': 'accessory_swift.png',    // 제압, 빠름
    '3ce83f54.png': 'accessory_strike.png',   // 방사, 타격
    '21b5680d.png': 'accessory_rapid.png',    // 속사, 연속
    'b14680de.png': 'accessory_destroy.png',  // 파괴, 지속
    
    // 엠블럼 룬 (카테고리 04)
    'a724b912.png': 'emblem_agility.png',     // 날쌤, 기민함
    'c02f9de3.png': 'emblem_steadfast.png',   // 굳건함, 현란함
    '20479c78.png': 'emblem_intense.png',     // 강렬함, 여신의 권능
    'a4380923.png': 'emblem_wisdom.png',      // 지혜로움, 친절함
    'b1f62fa9.png': 'emblem_fierce.png'       // 거셈, 쾌속
};

const IMAGE_DIR = './images/runes';
const JSON_FILE = './runes.json';

// 1. 이미지 파일 이름 변경
console.log('📂 이미지 파일 이름 변경 중...');
let renamed = 0;
let skipped = 0;

Object.entries(FILE_NAME_MAP).forEach(([oldName, newName]) => {
    const oldPath = path.join(IMAGE_DIR, oldName);
    const newPath = path.join(IMAGE_DIR, newName);
    
    if (fs.existsSync(oldPath)) {
        // 이미 새 이름으로 존재하면 스킵
        if (fs.existsSync(newPath) && oldPath !== newPath) {
            console.log(`⏭️ 스킵: ${oldName} (${newName} 이미 존재)`);
            skipped++;
            return;
        }
        
        fs.renameSync(oldPath, newPath);
        console.log(`✅ ${oldName} → ${newName}`);
        renamed++;
    } else if (fs.existsSync(newPath)) {
        console.log(`⏭️ 이미 변경됨: ${newName}`);
        skipped++;
    } else {
        console.log(`❌ 파일 없음: ${oldName}`);
    }
});

console.log(`\n📊 파일 이름 변경 완료: ${renamed}개 변경, ${skipped}개 스킵\n`);

// 2. JSON 파일의 이미지 경로 업데이트
console.log('📝 JSON 파일 업데이트 중...');
const runesData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
let updated = 0;

runesData.forEach(rune => {
    if (rune.image) {
        // 원본 URL에서 파일명 추출
        let filename;
        if (rune.image.includes('cdn.mabimobi.life')) {
            filename = rune.image.split('/').pop();
        } else if (rune.image.startsWith('images/runes/')) {
            filename = rune.image.split('/').pop();
        }
        
        if (filename && FILE_NAME_MAP[filename]) {
            rune.image = `images/runes/${FILE_NAME_MAP[filename]}`;
            updated++;
        } else if (filename) {
            // 이미 변경된 파일명인지 확인
            const isNewName = Object.values(FILE_NAME_MAP).includes(filename);
            if (!isNewName) {
                // 매핑에 없는 파일은 그대로 로컬 경로로
                rune.image = `images/runes/${filename}`;
            }
        }
    }
});

// JSON 저장
fs.writeFileSync(JSON_FILE, JSON.stringify(runesData, null, 4), 'utf8');
console.log(`✅ JSON 파일 업데이트 완료 (${updated}개 경로 변경)`);

console.log('\n🎉 모든 작업 완료!');

