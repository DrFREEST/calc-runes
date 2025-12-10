/**
 * 룬 이미지 다운로드 스크립트
 * @description JSON 파일의 이미지 URL을 로컬로 다운로드하고 경로 업데이트
 * @created 2025-12-10
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 설정
const JSON_FILE = './runes.json';
const OUTPUT_DIR = './images/runes';
const NEW_JSON_FILE = './runes.json'; // 같은 파일 덮어쓰기

// JSON 파일 읽기
console.log('📂 JSON 파일 읽는 중...');
const runesData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

// 고유한 이미지 URL 추출
const imageUrls = new Map(); // URL -> filename

runesData.forEach((rune, index) => {
    if (rune.image && rune.image.startsWith('http')) {
        const urlParts = rune.image.split('/');
        const filename = urlParts[urlParts.length - 1];
        imageUrls.set(rune.image, filename);
    }
});

console.log(`🖼️ 고유한 이미지 ${imageUrls.size}개 발견`);

// 이미지 다운로드 함수
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const file = fs.createWriteStream(filepath);
        
        protocol.get(url, (response) => {
            // 리다이렉트 처리
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadImage(response.headers.location, filepath)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${url}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {}); // 실패 시 파일 삭제
            reject(err);
        });
    });
}

// 메인 실행
async function main() {
    // 출력 디렉토리 생성
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // 이미지 다운로드
    const urlArray = Array.from(imageUrls.entries());
    let downloaded = 0;
    let failed = 0;
    
    console.log('📥 이미지 다운로드 시작...');
    
    for (const [url, filename] of urlArray) {
        const filepath = path.join(OUTPUT_DIR, filename);
        
        // 이미 존재하면 스킵
        if (fs.existsSync(filepath)) {
            console.log(`⏭️ 스킵: ${filename} (이미 존재)`);
            downloaded++;
            continue;
        }
        
        try {
            await downloadImage(url, filepath);
            downloaded++;
            console.log(`✅ [${downloaded}/${urlArray.length}] ${filename}`);
        } catch (err) {
            failed++;
            console.error(`❌ 실패: ${filename} - ${err.message}`);
        }
        
        // 요청 간 딜레이 (서버 부하 방지)
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 다운로드 완료: ${downloaded}개 성공, ${failed}개 실패`);
    
    // JSON 파일의 이미지 경로 업데이트
    console.log('\n📝 JSON 파일 업데이트 중...');
    
    runesData.forEach(rune => {
        if (rune.image && rune.image.startsWith('http')) {
            const urlParts = rune.image.split('/');
            const filename = urlParts[urlParts.length - 1];
            rune.image = `images/runes/${filename}`;
        }
    });
    
    // 업데이트된 JSON 저장
    fs.writeFileSync(NEW_JSON_FILE, JSON.stringify(runesData, null, 4), 'utf8');
    console.log('✅ JSON 파일 업데이트 완료!');
    
    console.log('\n🎉 모든 작업 완료!');
}

main().catch(err => {
    console.error('❌ 오류 발생:', err);
    process.exit(1);
});

