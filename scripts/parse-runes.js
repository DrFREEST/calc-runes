/**
 * ============================================================
 * 마비노기 모바일 룬 효과 파싱 스크립트
 * ============================================================
 * @file parse-runes.js
 * @description runes.json을 파싱하여 runes-parsed.json 생성
 * @created 2025-12-10
 * @version 1.0.0
 * 
 * @usage node parse-runes.js
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 상수 정의
// ============================================================

/**
 * 효과 타입 정의
 */
const EFFECT_TYPE = {
    PERMANENT: 'PERMANENT', // 상시 효과
    TRIGGER: 'TRIGGER', // 조건부 발동
    STACKING: 'STACKING', // 누적/중첩 효과
    DURATION: 'DURATION', // 지속 시간 효과
    DECAY: 'DECAY', // 시간 감소 효과
    STATE_CONDITION: 'STATE', // 상태 조건 효과
    AWAKENING: 'AWAKENING', // 각성 효과 (엠블럼)
    LIMITED: 'LIMITED' // 제한적 효과 (효율 미반영)
};

/**
 * 등급 매핑
 */
/**
 * 등급 매핑 @updated 2025-12-11 - 시즌1 전설 + 신화만 포함
 */
const GRADE_MAP = {
    '08_8': {
        name: '신화',
        color: '#FFD700',
        priority: 1
    },
    '05_8': {
        name: '전설(시즌1)',
        color: '#FF8C00',
        priority: 2
    }
    // 시즌0 전설(07_6, 05_6)은 제외
};

/**
 * 카테고리 매핑
 */
const CATEGORY_MAP = {
    '01': '무기',
    '02': '방어구',
    '03': '장신구',
    '04': '엠블럼'
};

/**
 * DPS 관련 핵심 효과
 */
const DPS_EFFECTS = [
    '공격력 증가', '피해량 증가', '치명타 확률 증가', '치명타 피해 증가',
    '연타 확률 증가', '강타 확률 증가', '추가타 확률 증가',
    '연타 피해 증가', '강타 피해 증가', '추가타 피해 증가',
    '스킬 피해 증가', '멀티히트 피해 증가'
];

/**
 * 결함 효과 (자신에게 불리한 효과)
 * @updated 2025-12-11 - "받는 피해 감소"는 긍정 효과이므로 제외
 */
const DEMERIT_EFFECTS = [
    '피해량 감소', '멀티히트 피해 감소', '치명타 확률 감소', '치명타 피해 감소',
    '공격력 감소', '쿨타임 회복 속도 감소', '스킬 사용 속도 감소', '캐스팅 속도 감소',
    '받는 피해 증가' // 자신이 받는 피해 증가만 결함
];

/**
 * 긍정 효과 (결함이 아닌 것)
 * @added 2025-12-11
 */
const POSITIVE_EFFECTS = [
    '받는 피해 감소', // 자신이 받는 피해 감소는 긍정
    '타겟이 받는 피해 증가', // 적이 받는 피해 증가도 긍정
    '적이 받는 피해 증가'
];

/**
 * 제한적 효과 키워드 (효율 미반영)
 * @updated 2025-12-11 - 기본 공격은 중첩 효과일 수 있으므로 제외
 */
const LIMITED_KEYWORDS = [
    '무방비 공격 적중', '브레이크 스킬', '브레이크 피해',
    '궁극기 사용 시', '각성 혹은 궁극기', '특정 스킬',
    '파티 플레이 시'
];

/**
 * 직업별 기본 공격 연계 효율 직업군
 */
const BASIC_ATTACK_CLASSES = ['도적', '듀얼블레이드', '격투가', '수도사'];

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * HTML 태그 제거
 */
function stripHtml(text) {
    if (!text) return '';
    // <br>, <br/>, <br /> 태그를 줄바꿈으로 변환 @fixed 2025-12-10
    text = text.replace(/<br\s*\/?>/gi, '\n');
    // 나머지 HTML 태그 제거
    return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * 등급 정보 가져오기
 */
function getGradeInfo(grade, stars) {
    var key = grade + '_' + stars;
    return GRADE_MAP[key] || null;
}

/**
 * 숫자 추출 (첫 번째 숫자)
 */
function extractNumber(text) {
    var match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
}

/**
 * 모든 숫자 추출
 */
function extractAllNumbers(text) {
    var matches = text.match(/(\d+(?:\.\d+)?)/g);
    return matches ? matches.map(function(n) {
        return parseFloat(n);
    }) : [];
}

/**
 * 범위값 파싱 (N~M% 또는 N/M% 형태)
 * @added 2025-12-10
 */
function parseRangeValue(text) {
    // N~M% 형태 (예: 10%~30%)
    var rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*%?\s*~\s*(\d+(?:\.\d+)?)\s*%/);
    if (rangeMatch) {
        return {
            type: 'range',
            min: parseFloat(rangeMatch[1]),
            max: parseFloat(rangeMatch[2]),
            average: (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2
        };
    }

    // N/M% 형태 (예: 9/11%)
    var slashMatch = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*%/);
    if (slashMatch) {
        return {
            type: 'tiered',
            base: parseFloat(slashMatch[1]),
            enhanced: parseFloat(slashMatch[2]),
            average: (parseFloat(slashMatch[1]) + parseFloat(slashMatch[2])) / 2
        };
    }

    // 최소 N%에서 최대 M%까지
    var minMaxMatch = text.match(/최소\s*(\d+(?:\.\d+)?)\s*%?에서\s*최대\s*(\d+(?:\.\d+)?)\s*%/);
    if (minMaxMatch) {
        return {
            type: 'minmax',
            min: parseFloat(minMaxMatch[1]),
            max: parseFloat(minMaxMatch[2]),
            average: (parseFloat(minMaxMatch[1]) + parseFloat(minMaxMatch[2])) / 2
        };
    }

    return null;
}

// ============================================================
// 효과 파싱 함수들
// ============================================================

/**
 * 조건 키워드 감지
 * @updated 2025-12-10 - 누락된 패턴 대거 추가
 */
function detectCondition(text) {
    var conditions = [];

    // ========================================
    // 트리거 조건 (공격/스킬 관련)
    // ========================================

    // 기본 공격 관련
    if (/기본\s*공격\s*사용\s*시/.test(text)) conditions.push('기본 공격 사용 시');
    else if (/기본\s*공격\s*적중\s*시/.test(text)) conditions.push('기본 공격 적중 시');
    else if (/기본\s*공격\s*시/.test(text)) conditions.push('기본 공격 시');

    // 스킬 관련
    if (/스킬을?\s*사용할?\s*때마다/.test(text)) conditions.push('스킬 사용할 때마다');
    else if (/스킬\s*사용\s*또는\s*기본\s*공격\s*시/.test(text)) conditions.push('스킬/기본 공격 시');
    else if (/스킬\s*사용\s*시/.test(text)) conditions.push('스킬 사용 시');

    // 보조/생존/방해 스킬
    if (/보조[,\s]*생존\s*스킬\s*사용\s*시/.test(text)) conditions.push('보조/생존 스킬 사용 시');
    else if (/보조\s*스킬\s*사용\s*시/.test(text)) conditions.push('보조 스킬 사용 시');
    if (/방해\s*스킬\s*사용\s*시/.test(text)) conditions.push('방해 스킬 사용 시');
    if (/생존\s*스킬\s*사용\s*시/.test(text)) conditions.push('생존 스킬 사용 시');

    // 적중 관련
    if (/공격\s*적중\s*시/.test(text) && !/기본\s*공격/.test(text) && !/무방비/.test(text)) {
        conditions.push('공격 적중 시');
    }
    if (/강타\s*적중\s*시/.test(text)) conditions.push('강타 적중 시');
    if (/연타\s*적중\s*시/.test(text)) conditions.push('연타 적중 시');
    if (/추가타\s*적중\s*시/.test(text)) conditions.push('추가타 적중 시');
    if (/치명타\s*적중\s*시/.test(text)) conditions.push('치명타 적중 시');
    if (/피니시\s*어택\s*적중\s*시/.test(text)) conditions.push('피니시 어택 적중 시');
    if (/카운터\s*공격\s*적중\s*시/.test(text)) conditions.push('카운터 공격 적중 시');
    if (/크로스\s*공격\s*적중\s*시/.test(text)) conditions.push('크로스 공격 적중 시');

    // 무방비/브레이크 관련
    if (/무방비\s*공격\s*적중\s*시/.test(text)) conditions.push('무방비 공격 적중 시');
    if (/무방비\s*공격\s*시/.test(text) && !/적중/.test(text)) conditions.push('무방비 공격 시');
    if (/브레이크\s*스킬/.test(text)) conditions.push('브레이크 스킬');

    // 궁극기/각성 관련
    if (/각성\s*혹은\s*궁극기\s*사용\s*시/.test(text)) conditions.push('각성/궁극기 사용 시');
    else if (/궁극기를?\s*사용\s*시/.test(text) || /궁극기\s*사용\s*시/.test(text)) conditions.push('궁극기 사용 시');

    // 전투 시작/중
    if (/전투\s*시작\s*시/.test(text)) conditions.push('전투 시작 시');
    if (/전투\s*중[,\s]/.test(text)) {
        var intervalMatch = text.match(/전투\s*중[,\s]*(?:매\s*)?(\d+(?:\.\d+)?)\s*초\s*마다/);
        if (intervalMatch) {
            conditions.push('전투 중 ' + intervalMatch[1] + '초마다');
        } else {
            conditions.push('전투 중');
        }
    }

    // 회복 관련
    if (/아군.*체력.*회복/.test(text) || /아군의?\s*체력을?\s*회복/.test(text)) {
        conditions.push('아군 체력 회복 시');
    }

    // 지속 피해 보유 적 공격
    var dotMatch = text.match(/지속\s*피해[:\s]*([가-힣,\s]+)을?\s*보유한\s*적\s*공격\s*시/);
    if (dotMatch) {
        conditions.push('지속 피해(' + dotMatch[1].trim() + ') 보유 적 공격 시');
    }

    // 확률 조건
    if (/일정\s*확률로/.test(text)) conditions.push('일정 확률');
    var probMatch = text.match(/(\d+)\s*%\s*확률로/);
    if (probMatch) conditions.push(probMatch[1] + '% 확률');

    // ========================================
    // 상태 조건 (HP/자원/클래스 레벨 등)
    // ========================================

    // 체력 조건
    var hpAboveMatch = text.match(/체력이?\s*(\d+)\s*%\s*이상/);
    if (hpAboveMatch) conditions.push('체력 ' + hpAboveMatch[1] + '% 이상');

    var hpBelowMatch = text.match(/체력이?\s*(\d+)\s*%\s*이하/);
    if (hpBelowMatch) conditions.push('체력 ' + hpBelowMatch[1] + '% 이하');

    // 자원 조건
    var resourceMatch = text.match(/(?:보유\s*)?자원이?\s*(\d+)\s*%\s*(미만|이상|이하)/);
    if (resourceMatch) conditions.push('자원 ' + resourceMatch[1] + '% ' + resourceMatch[2]);

    // 클래스 레벨 조건
    var classLevelMatch = text.match(/클래스\s*레벨이?\s*(\d+)\s*이상/);
    if (classLevelMatch) conditions.push('클래스 레벨 ' + classLevelMatch[1] + ' 이상');

    var classLevelAchieveMatch = text.match(/클래스\s*레벨\s*(\d+)을?\s*달성할?\s*때마다/);
    if (classLevelAchieveMatch) conditions.push('클래스 레벨 ' + classLevelAchieveMatch[1] + ' 달성마다');

    // 이동/거리 조건
    var noMoveMatch = text.match(/(\d+)\s*초\s*동안\s*이동하지\s*않을\s*경우/);
    if (noMoveMatch) conditions.push(noMoveMatch[1] + '초 이동 안함');

    var noEnemyNearMatch = text.match(/주변\s*(\d+)\s*m\s*범위\s*내에\s*적이\s*없을\s*경우/);
    if (noEnemyNearMatch) conditions.push('주변 ' + noEnemyNearMatch[1] + 'm 적 없음');

    // 적 수 조건
    if (/적의\s*수가\s*많을수록/.test(text)) conditions.push('주변 적 수 비례');

    // 각성 활성화 조건
    if (/엠블럼의?\s*각성\s*효과가?\s*활성화된?\s*동안/.test(text)) conditions.push('각성 활성화 중');

    // 피해 받을 시
    if (/피해를?\s*받으면/.test(text)) conditions.push('피해 받으면 초기화');

    // 적 처치 시
    if (/적이?\s*처치되었을?\s*경우/.test(text) || /전투\s*중인\s*적이\s*처치/.test(text)) {
        conditions.push('적 처치 시');
    }

    // 도발 관련
    if (/적을?\s*도발할?\s*경우/.test(text) || /적을?\s*도발하면/.test(text)) {
        conditions.push('도발 시');
    }

    // 가방 무게 조건
    var bagMatch = text.match(/가방의?\s*무게가?\s*(\d+)\s*%\s*이하/);
    if (bagMatch) conditions.push('가방 무게 ' + bagMatch[1] + '% 이하');

    // 전력/충전 조건
    var powerMatch = text.match(/(\d+)\s*이상의?\s*(?:전력|충전)을?\s*보유/);
    if (powerMatch) conditions.push('전력 ' + powerMatch[1] + ' 이상');
    if (/과부하\s*상태/.test(text)) conditions.push('과부하 상태');

    // 중첩 도달 조건
    var stackReachMatch = text.match(/(\d+)\s*중첩\s*도달\s*시/);
    if (stackReachMatch) conditions.push(stackReachMatch[1] + '중첩 도달 시');

    var stackCountMatch = text.match(/중첩이?\s*(\d+)\s*회\s*쌓일\s*경우/);
    if (stackCountMatch) conditions.push(stackCountMatch[1] + '중첩 시');

    // 파티 플레이
    if (/파티\s*플레이\s*시/.test(text)) conditions.push('파티 플레이 시');

    // 각인 보유 시너지
    var runeHaveMatch = text.match(/([가-힣]+의?\s*각인)을?\s*보유한?\s*경우/);
    if (runeHaveMatch) conditions.push(runeHaveMatch[1] + ' 보유 시');

    // 대상당 쿨타임
    var perTargetMatch = text.match(/각\s*대상마다\s*(\d+)\s*초에?\s*한\s*번/);
    if (perTargetMatch) conditions.push('대상당 ' + perTargetMatch[1] + '초 쿨타임');

    // 공격 시 (적중 없이) - 가장 일반적인 트리거
    if (/^공격\s*시[,\s]/.test(text) && !/적중/.test(text)) {
        conditions.push('공격 시');
    }

    // ========================================
    // 추가 조건 패턴 @added 2025-12-10
    // ========================================

    // 전투 종료 시까지
    if (/전투\s*종료\s*시까지/.test(text) || /전투\s*종료까지/.test(text)) {
        conditions.push('전투 종료까지');
    }

    // 음식/배고픔 상태
    if (/음식\s*효과가?\s*지속되는\s*동안/.test(text)) conditions.push('음식 효과 중');
    if (/배고픈\s*상태로?\s*전투/.test(text)) conditions.push('배고픈 상태');

    // 보호막 관련
    if (/보호막\s*(?:계열\s*)?효과가?\s*유지되는\s*동안/.test(text)) conditions.push('보호막 유지 중');
    if (/포션을?\s*사용/.test(text)) conditions.push('포션 사용 시');

    // 특정 횟수 공격
    var attackCountMatch = text.match(/타겟\s*한\s*명을?\s*(\d+)\s*번\s*공격할?\s*때마다/);
    if (attackCountMatch) conditions.push('타겟 ' + attackCountMatch[1] + '회 공격마다');

    // 지속 피해 효과를 받을 때마다
    if (/지속\s*피해.*효과를?\s*받을\s*때마다/.test(text)) conditions.push('지속 피해 효과 시');

    // 스킬 공격 + 치명타
    if (/스킬\s*공격이?\s*치명타로?\s*적중/.test(text)) conditions.push('스킬 치명타 시');

    // 단독 N초마다
    var intervalOnlyMatch = text.match(/^(\d+)\s*초마다/);
    if (intervalOnlyMatch) conditions.push(intervalOnlyMatch[1] + '초마다');

    // 스킬 변환 룬
    if (/스킬에\s*변화를?\s*준다/.test(text)) conditions.push('스킬 변환');

    // 각인 위치
    if (/상의에\s*각인\s*시/.test(text)) conditions.push('상의 각인');
    if (/하의에\s*각인\s*시/.test(text)) conditions.push('하의 각인');

    // 누적 효과 발생 시
    if (/누적\s*효과가?\s*발생할?\s*때/.test(text)) conditions.push('누적 효과 발생 시');

    // 브레이크 당할 경우
    if (/브레이크\s*당할\s*경우/.test(text)) conditions.push('브레이크 당할 시');

    // 적 체력 조건
    var enemyHpMatch = text.match(/적이?\s*일정\s*체력\s*이하/);
    if (enemyHpMatch) conditions.push('적 체력 일정 이하');

    var enemyHpAboveMatch = text.match(/타겟의?\s*체력이?\s*일정\s*비율\s*이상/);
    if (enemyHpAboveMatch) conditions.push('적 체력 일정 이상');

    return conditions.length > 0 ? conditions : null;
}

/**
 * 지속 시간 추출
 */
function extractDuration(text) {
    var match = text.match(/(\d+(?:\.\d+)?)\s*초\s*동안/);
    return match ? parseFloat(match[1]) : null;
}

/**
 * 쿨타임 추출
 */
/**
 * 쿨타임 추출 @updated 2025-12-11 - 다양한 패턴 추가
 */
function extractCooldown(text) {
    // 패턴 1: (재사용 대기 시간: N초)
    var match1 = text.match(/\(재사용\s*대기\s*시간[:\s]*(\d+(?:\.\d+)?)\s*초\)/);
    if (match1) return parseFloat(match1[1]);

    // 패턴 2: 재사용 대기 시간: N초
    var match2 = text.match(/재사용\s*대기\s*시간[:\s]*(\d+(?:\.\d+)?)\s*초/);
    if (match2) return parseFloat(match2[1]);

    // 패턴 3: 재사용 대기시간: N초
    var match3 = text.match(/재사용\s*대기시간[:\s]*(\d+(?:\.\d+)?)\s*초/);
    if (match3) return parseFloat(match3[1]);

    // 패턴 4: (재사용 대기시간 N초)
    var match4 = text.match(/\(재사용\s*대기시간\s*(\d+(?:\.\d+)?)\s*초\)/);
    if (match4) return parseFloat(match4[1]);

    // 패턴 5: 각 N초 형태 (여러 효과에 대한 공통 쿨타임)
    var match5 = text.match(/\(재사용\s*대기\s*시간[:\s]*각\s*(\d+(?:\.\d+)?)\s*초\)/);
    if (match5) return parseFloat(match5[1]);

    return null;
}

/**
 * 중첩 정보 추출
 * @updated 2025-12-10 - 다양한 중첩 패턴 추가
 */
function extractStackInfo(text) {
    var result = {
        maxStacks: null,
        stackValue: null,
        isIndependentDuration: false, // 스택마다 개별 지속시간
        isAccumulation: false, // 누적/축적 효과
        resetCondition: null // 초기화 조건
    };

    // 최대 중첩 횟수
    var maxStackPatterns = [
        /최대\s*(\d+)\s*회까지\s*중첩/,
        /해당\s*효과는?\s*최대\s*(\d+)\s*회까지\s*중첩/,
        /각\s*효과는?\s*최대\s*(\d+)\s*회까지\s*중첩/
    ];

    for (var i = 0; i < maxStackPatterns.length; i++) {
        var match = text.match(maxStackPatterns[i]);
        if (match) {
            result.maxStacks = parseInt(match[1]);
            break;
        }
    }

    // 중첩당 수치
    var stackValuePatterns = [
        /(\d+(?:\.\d+)?)\s*%씩?\s*증가.*중첩/,
        /(\d+(?:\.\d+)?)\s*%\s*증가하며.*최대/,
        /중첩.*(\d+(?:\.\d+)?)\s*%/
    ];

    for (var j = 0; j < stackValuePatterns.length; j++) {
        var valMatch = text.match(stackValuePatterns[j]);
        if (valMatch) {
            result.stackValue = parseFloat(valMatch[1]);
            break;
        }
    }

    // 독립 지속시간 체크
    if (/지속\s*시간은?\s*스택마다\s*개별/.test(text) || /스택마다\s*개별로\s*가진다/.test(text)) {
        result.isIndependentDuration = true;
    }

    // 누적/축적 효과 체크
    if (/^누적\s*:/m.test(text) || /^축적\s*:/m.test(text)) {
        result.isAccumulation = true;
    }

    // 초기화 조건 @updated 2025-12-11 - 더 많은 패턴 추가
    if (/연타가\s*아닌\s*공격\s*적중\s*시.*해제/.test(text)) {
        result.resetCondition = '연타 외 공격 시 해제';
    }
    if (/피해를?\s*받으면.*초기화/.test(text) || /피해를?\s*받으면\s*효과가?\s*초기화/.test(text)) {
        result.resetCondition = '피해 받으면 초기화';
    }
    if (/피해를?\s*받으면\s*효과가?\s*(?:즉시\s*)?해제/.test(text)) {
        result.resetCondition = '피해 받으면 해제';
    }
    if (/적중\s*시[,\s]*효과가?\s*(?:즉시\s*)?해제/.test(text)) {
        result.resetCondition = '적중 시 해제';
    }
    if (/전투\s*종료\s*시/.test(text)) {
        result.resetCondition = '전투 종료 시 초기화';
    }

    // 유효한 정보가 있으면 반환
    if (result.maxStacks || result.isAccumulation || result.resetCondition) {
        return result;
    }
    return null;
}

/**
 * 시간 감소(Decay) 효과 파싱
 */
function parseDecayEffect(text) {
    // 패턴: "전투 시작 시, 공격력이 X% 증가한다. 증가한 공격력은 매 N초마다 Y%씩 감소한다."
    var decayPattern = /전투\s*시작\s*시.*?(\d+(?:\.\d+)?)\s*%\s*증가.*매\s*(\d+(?:\.\d+)?)\s*초마다\s*(\d+(?:\.\d+)?)\s*%씩?\s*감소/;
    var match = text.match(decayPattern);

    if (match) {
        var initialValue = parseFloat(match[1]);
        var interval = parseFloat(match[2]);
        var decayRate = parseFloat(match[3]);

        // 효과가 0이 되는 시간
        var decayDuration = (initialValue / decayRate) * interval;

        // 120초 전투 기준 평균값 계산
        var combatDuration = 120;
        var effectiveTime = Math.min(decayDuration, combatDuration);

        // 삼각형 면적 공식으로 평균값 계산
        var averageValue = (initialValue * effectiveTime / 2) / combatDuration;

        return {
            hasDecay: true,
            initialValue: initialValue,
            interval: interval,
            decayRate: decayRate,
            decayDuration: decayDuration,
            effectiveValue: Math.round(averageValue * 100) / 100,
            rawText: match[0]
        };
    }
    return null;
}

/**
 * 엠블럼 각성 효과 파싱
 */
function parseAwakeningEffect(text, rune) {
    if (rune.category !== '04') return null;

    // 각성 패턴 @fixed 2025-12-10
    // 패턴 1: "공격 시 N% 확률로 각성하여 M초 동안"
    // 패턴 2: "공격 시 N% 확률로 M초 동안 각성"
    // 패턴 3: "무방비 공격 시 각성하여" (확률 없음 = 100%)
    var awakeningPattern1 = /공격\s*시[,.]?\s*(\d+(?:\.\d+)?)\s*%\s*확률로\s*각성하여\s*(\d+(?:\.\d+)?)\s*초\s*동안/;
    var awakeningPattern2 = /공격\s*시[,.]?\s*(\d+(?:\.\d+)?)\s*%\s*확률로\s*(\d+(?:\.\d+)?)\s*초\s*동안\s*각성/;
    var awakeningPattern3 = /무방비\s*공격\s*시[,.]?\s*각성하여\s*(\d+(?:\.\d+)?)\s*초\s*동안/;

    var match = text.match(awakeningPattern1) || text.match(awakeningPattern2);
    var isDefenseBreak = false;

    // 무방비 공격 각성 체크
    if (!match) {
        match = text.match(awakeningPattern3);
        if (match) {
            isDefenseBreak = true;
        }
    }

    if (!match) return null;

    var triggerChance, duration;
    if (isDefenseBreak) {
        // 무방비 공격: 100% 확률, match[1]이 duration
        triggerChance = 100;
        duration = parseFloat(match[1]);
    } else {
        triggerChance = parseFloat(match[1]);
        duration = parseFloat(match[2]);
    }
    var baseCooldown = 90; // 기본 각성 쿨타임

    // 각성 효과 내용 추출
    var effectsText = text.substring(text.indexOf('각성'));
    var effects = [];

    // 효과 패턴들 @fixed 2025-12-10 - 구체적 패턴을 먼저 적용
    var effectPatterns = [
        // 공격력 (최우선)
        {
            pattern: /공격력이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '공격력 증가'
        },
        // 구체적 피해 유형 (일반 피해량보다 먼저)
        {
            pattern: /연타\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '연타 피해 증가',
            isSpecific: true
        },
        {
            pattern: /강타\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '강타 피해 증가',
            isSpecific: true
        },
        {
            pattern: /추가타\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '추가타 피해 증가',
            isSpecific: true
        },
        {
            pattern: /스킬\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '스킬 피해 증가',
            isSpecific: true
        },
        {
            pattern: /치명타\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '치명타 피해 증가',
            isSpecific: true
        },
        // 확률
        {
            pattern: /치명타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '치명타 확률 증가'
        },
        {
            pattern: /연타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '연타 확률 증가'
        },
        {
            pattern: /강타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '강타 확률 증가'
        },
        {
            pattern: /추가타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '추가타 확률 증가'
        },
        // 속도
        {
            pattern: /캐스팅\s*속도가?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '캐스팅 속도 증가'
        },
        {
            pattern: /쿨타임\s*회복\s*속도가?\s*(\d+(?:\.\d+)?)\s*%/,
            name: '쿨타임 회복 속도 증가'
        }
    ];

    // 중복 방지를 위한 이미 추출된 값 추적
    var extractedValues = [];

    effectPatterns.forEach(function(ep) {
        var m = effectsText.match(ep.pattern);
        if (m) {
            var value = parseFloat(m[1]);
            // 이미 같은 값이 구체적 패턴으로 추출되었으면 건너뛰기
            var isDuplicate = extractedValues.some(function(ev) {
                return ev.value === value && !ep.isSpecific;
            });
            if (!isDuplicate) {
                effects.push({
                    effect: ep.name,
                    value: value,
                    unit: '%'
                });
                if (ep.isSpecific) {
                    extractedValues.push({
                        name: ep.name,
                        value: value
                    });
                }
            }
        }
    });

    // 업타임 계산: duration / (duration + cooldown)
    var uptime = duration / (duration + baseCooldown);

    // 제한적 각성 체크 (기본 공격, 무방비 등)
    var isLimited = /기본\s*공격/.test(effectsText) || /무방비/.test(effectsText);

    return {
        type: EFFECT_TYPE.AWAKENING,
        triggerChance: triggerChance,
        duration: duration,
        baseCooldown: baseCooldown,
        uptime: Math.round(uptime * 1000) / 10, // 퍼센트로 표시
        effects: effects,
        isLimited: isLimited
    };
}

/**
 * 클래스 제한 추출
 * @added 2025-12-10
 */
function extractClassRestriction(text) {
    var classPatterns = [{
            pattern: /\(전사\s*계열\s*클래스\s*전용\)/,
            class: '전사계열'
        },
        {
            pattern: /\(도적\s*계열\s*클래스\s*전용\)/,
            class: '도적계열'
        },
        {
            pattern: /\(마법사\s*계열\s*클래스\s*전용\)/,
            class: '마법사계열'
        },
        {
            pattern: /\(힐러\s*계열\s*클래스\s*전용\)/,
            class: '힐러계열'
        },
        {
            pattern: /\(궁수\s*계열\s*클래스\s*전용\)/,
            class: '궁수계열'
        },
        {
            pattern: /\(음유시인\s*계열\s*클래스\s*전용\)/,
            class: '음유시인계열'
        },
        {
            pattern: /검을\s*사용하는\s*클래스/,
            class: '검사용클래스'
        }
    ];

    for (var i = 0; i < classPatterns.length; i++) {
        if (classPatterns[i].pattern.test(text)) {
            return classPatterns[i].class;
        }
    }
    return null;
}

/**
 * 상시 효과 파싱 (엠블럼)
 * @added 2025-12-10
 */
function parsePassiveEffect(text) {
    var passiveMatch = text.match(/상시\s*효과[:\s]*([^<]+)/);
    if (passiveMatch) {
        return parseSingleEffect(passiveMatch[1]);
    }
    return null;
}

/**
 * 특수 중첩 효과 파싱 (클래스 레벨 달성, 기본 공격, 시간 기반 등)
 * @added 2025-12-11
 */
function parseSpecialStackingEffect(text) {
    var result = null;

    // ===================================================================
    // 패턴 1: 클래스 레벨 달성마다 효과
    // "클래스 레벨 N을 달성할 때마다 공격력이 X%씩 증가...최대 M회"
    // ===================================================================
    var classLevelPattern = /클래스\s*레벨\s*(\d+)을?\s*달성할?\s*때마다\s*(?:추가로\s*)?([가-힣\s]+)(?:이|가)?\s*(\d+(?:\.\d+)?)\s*%씩?\s*증가.*최대\s*(\d+)\s*회까지\s*중첩/;
    var classLevelMatch = text.match(classLevelPattern);
    if (classLevelMatch) {
        var effectName = classLevelMatch[2].trim().replace(/\s+/g, ' ');
        // 효과명 정규화
        if (effectName.includes('공격력')) effectName = '공격력 증가';
        else if (effectName.includes('피해')) effectName = '피해량 증가';
        else effectName = effectName + ' 증가';

        var stackValue = parseFloat(classLevelMatch[3]);
        var maxStacks = parseInt(classLevelMatch[4]);
        var classLevelRequired = parseInt(classLevelMatch[1]);
        var maxValue = stackValue * maxStacks;

        result = {
            rawText: text.trim(),
            effects: [{
                effect: effectName,
                value: maxValue, // 최대 달성 시 값
                stackValue: stackValue,
                maxStacks: maxStacks,
                unit: '%',
                dpsRelevant: DPS_EFFECTS.includes(effectName)
            }],
            demerits: [],
            type: EFFECT_TYPE.STATE_CONDITION, // 클래스 레벨 조건
            condition: ['클래스 레벨 ' + classLevelRequired + ' 달성마다'],
            duration: null,
            cooldown: null,
            stackInfo: {
                maxStacks: maxStacks,
                stackValue: stackValue,
                isClassLevel: true,
                classLevelRequired: classLevelRequired
            },
            isLimited: false,
            classRestriction: extractClassRestriction(text),
            consumeStack: false,
            doubleOnAwakening: false
        };
        return result;
    }

    // ===================================================================
    // 패턴 2: 기본 공격 시 중첩 효과 @updated 2025-12-11
    // "기본 공격 시, N초 동안 공격력이 X%씩 증가...최대 M회"
    // 중첩 효과이므로 STACKING으로 분류, 단 dpsRelevant는 false (기본공격 DPS 제외)
    // ===================================================================
    var basicAttackStackPattern = /기본\s*공격\s*시[,.]?\s*(\d+(?:\.\d+)?)\s*초\s*동안\s*([가-힣\s]+)(?:이|가)?\s*(\d+(?:\.\d+)?)\s*%씩?\s*증가.*최대\s*(\d+)\s*회까지\s*중첩/;
    var basicAttackMatch = text.match(basicAttackStackPattern);
    if (basicAttackMatch) {
        var effectName2 = basicAttackMatch[2].trim().replace(/\s+/g, ' ');
        if (effectName2.includes('공격력')) effectName2 = '공격력 증가';
        else if (effectName2.includes('피해')) effectName2 = '피해량 증가';
        else effectName2 = effectName2 + ' 증가';

        var duration2 = parseFloat(basicAttackMatch[1]);
        var stackValue2 = parseFloat(basicAttackMatch[3]);
        var maxStacks2 = parseInt(basicAttackMatch[4]);
        var maxValue2 = stackValue2 * maxStacks2;

        result = {
            rawText: text.trim(),
            effects: [{
                effect: effectName2,
                value: maxValue2,
                stackValue: stackValue2,
                maxStacks: maxStacks2,
                unit: '%',
                dpsRelevant: false // 기본 공격은 DPS에서 제외
            }],
            demerits: [],
            type: EFFECT_TYPE.STACKING, // @fixed 2025-12-11: 중첩 효과는 STACKING
            condition: ['기본 공격 시'],
            duration: duration2,
            cooldown: null,
            stackInfo: {
                maxStacks: maxStacks2,
                stackValue: stackValue2,
                isBasicAttack: true
            },
            isLimited: false, // @fixed 2025-12-11: 중첩 효과는 LIMITED 아님
            classRestriction: null,
            consumeStack: false,
            doubleOnAwakening: false
        };
        return result;
    }

    // ===================================================================
    // 패턴 3: 시간 기반 중첩 효과
    // "전투 중, 매 N초마다 효과가 X%씩 증가...최대 M회"
    // ===================================================================
    var timeStackPattern = /전투\s*중[,.]?\s*(?:매\s*)?(\d+(?:\.\d+)?)\s*초마다\s*([가-힣\s]+)(?:이|가)?\s*(\d+(?:\.\d+)?)\s*%씩?\s*증가.*최대\s*(\d+)\s*회까지\s*중첩/;
    var timeStackMatch = text.match(timeStackPattern);
    if (timeStackMatch) {
        var effectName3 = timeStackMatch[2].trim().replace(/\s+/g, ' ');
        if (effectName3.includes('공격력')) effectName3 = '공격력 증가';
        else if (effectName3.includes('피해')) effectName3 = '피해량 증가';
        else if (effectName3.includes('방어력')) effectName3 = '방어력 증가';
        else effectName3 = effectName3 + ' 증가';

        var interval = parseFloat(timeStackMatch[1]);
        var stackValue3 = parseFloat(timeStackMatch[3]);
        var maxStacks3 = parseInt(timeStackMatch[4]);
        var maxValue3 = stackValue3 * maxStacks3;

        // 최대 중첩까지 걸리는 시간
        var timeToMaxStack = interval * maxStacks3;

        result = {
            rawText: text.trim(),
            effects: [{
                effect: effectName3,
                value: maxValue3,
                stackValue: stackValue3,
                maxStacks: maxStacks3,
                unit: '%',
                dpsRelevant: DPS_EFFECTS.includes(effectName3)
            }],
            demerits: [],
            type: EFFECT_TYPE.STACKING,
            condition: ['전투 중 ' + interval + '초마다'],
            duration: null,
            cooldown: null,
            stackInfo: {
                maxStacks: maxStacks3,
                stackValue: stackValue3,
                interval: interval,
                timeToMaxStack: timeToMaxStack,
                isTimeBased: true
            },
            isLimited: false,
            classRestriction: null,
            consumeStack: false,
            doubleOnAwakening: false
        };
        return result;
    }

    // ===================================================================
    // 패턴 4: 피격 시 중첩 효과
    // "피해를 받으면 N초간 효과가 X%씩 증가...최대 M회"
    // ===================================================================
    var hitStackPattern = /(?:적에게\s*)?피해를?\s*받으면\s*(\d+(?:\.\d+)?)\s*초(?:간|동안)\s*([가-힣\s]+)(?:이|가)?\s*(\d+(?:\.\d+)?)\s*%씩?\s*증가.*최대\s*(\d+)\s*회까지\s*중첩/;
    var hitStackMatch = text.match(hitStackPattern);
    if (hitStackMatch) {
        var effectName4 = hitStackMatch[2].trim().replace(/\s+/g, ' ');
        if (effectName4.includes('공격력')) effectName4 = '공격력 증가';
        else if (effectName4.includes('피해')) effectName4 = '피해량 증가';
        else if (effectName4.includes('방어력')) effectName4 = '방어력 증가';
        else effectName4 = effectName4 + ' 증가';

        var duration4 = parseFloat(hitStackMatch[1]);
        var stackValue4 = parseFloat(hitStackMatch[3]);
        var maxStacks4 = parseInt(hitStackMatch[4]);
        var maxValue4 = stackValue4 * maxStacks4;

        result = {
            rawText: text.trim(),
            effects: [{
                effect: effectName4,
                value: maxValue4,
                stackValue: stackValue4,
                maxStacks: maxStacks4,
                unit: '%',
                dpsRelevant: DPS_EFFECTS.includes(effectName4)
            }],
            demerits: [],
            type: EFFECT_TYPE.STACKING, // @fixed 2025-12-11: 중첩 효과는 STACKING
            condition: ['피해 받으면'],
            duration: duration4,
            cooldown: null,
            stackInfo: {
                maxStacks: maxStacks4,
                stackValue: stackValue4,
                isHitBased: true
            },
            isLimited: false,
            classRestriction: null,
            consumeStack: false,
            doubleOnAwakening: false
        };
        return result;
    }

    // ===================================================================
    // 패턴 5: 보조/생존 스킬 사용 시 중첩 (힐러 계열 등)
    // "보조 스킬 사용 시, N초 동안 효과가 X%씩 증가...최대 M회"
    // ===================================================================
    var supportSkillStackPattern = /(?:보조|생존)(?:,?\s*(?:보조|생존))?\s*스킬\s*사용\s*시[,.]?\s*(\d+(?:\.\d+)?)\s*초\s*동안\s*([^.]+?)(?:이|가)?\s*(\d+(?:\.\d+)?)\s*%씩?\s*증가.*최대\s*(\d+)\s*회까지\s*중첩/;
    var supportMatch = text.match(supportSkillStackPattern);
    if (supportMatch) {
        var effectDesc = supportMatch[2].trim();
        var effects = [];

        // 공격력/회복력 등 여러 효과 분리
        if (effectDesc.includes('공격력')) {
            effects.push({
                effect: '공격력 증가',
                value: parseFloat(supportMatch[3]) * parseInt(supportMatch[4]),
                stackValue: parseFloat(supportMatch[3]),
                maxStacks: parseInt(supportMatch[4]),
                unit: '%',
                dpsRelevant: true
            });
        }
        if (effectDesc.includes('회복') || effectDesc.includes('회복력')) {
            effects.push({
                effect: '회복량 증가',
                value: parseFloat(supportMatch[3]) * parseInt(supportMatch[4]),
                stackValue: parseFloat(supportMatch[3]),
                maxStacks: parseInt(supportMatch[4]),
                unit: '%',
                dpsRelevant: false
            });
        }
        // 효과가 하나도 파싱되지 않으면 일반 효과로 추가
        if (effects.length === 0) {
            effects.push({
                effect: effectDesc + ' 증가',
                value: parseFloat(supportMatch[3]) * parseInt(supportMatch[4]),
                stackValue: parseFloat(supportMatch[3]),
                maxStacks: parseInt(supportMatch[4]),
                unit: '%',
                dpsRelevant: false
            });
        }

        result = {
            rawText: text.trim(),
            effects: effects,
            demerits: [],
            type: EFFECT_TYPE.STACKING,
            condition: ['보조/생존 스킬 사용 시'],
            duration: parseFloat(supportMatch[1]),
            cooldown: null,
            stackInfo: {
                maxStacks: parseInt(supportMatch[4]),
                stackValue: parseFloat(supportMatch[3]),
                isSupportSkill: true
            },
            isLimited: false,
            classRestriction: extractClassRestriction(text),
            consumeStack: false,
            doubleOnAwakening: false
        };
        return result;
    }

    // ===================================================================
    // 패턴 6: 타겟 공격 횟수 조건 (충격파 등 특수 효과)
    // "타겟 한 명을 N번 공격할 때마다 효과 발생"
    // ===================================================================
    var attackCountPattern = /타겟\s*한\s*명을?\s*(\d+)\s*번\s*공격할?\s*때마다\s*([^.]+)/;
    var attackCountMatch = text.match(attackCountPattern);
    if (attackCountMatch) {
        result = {
            rawText: text.trim(),
            effects: [], // 충격파 등 특수 효과는 수치화 어려움
            demerits: [],
            type: EFFECT_TYPE.TRIGGER,
            condition: ['타겟 ' + attackCountMatch[1] + '회 공격마다'],
            duration: null,
            cooldown: extractCooldown(text),
            stackInfo: null,
            isLimited: true, // 특수 효과 → 제한적으로 분류
            classRestriction: null,
            consumeStack: false,
            doubleOnAwakening: false
        };
        return result;
    }

    // ===================================================================
    // 패턴 7: 중첩 적중 시 소모 후 효과
    // "N중첩 도달 시, 중첩을 모두 소모하여 N초 동안 효과"
    // ===================================================================
    var consumeStackPattern = /(\d+)\s*중첩\s*도달\s*시[,.]?\s*중첩을?\s*(?:모두\s*)?소모하여\s*(\d+(?:\.\d+)?)\s*초\s*동안\s*([가-힣\s]+)(?:이|가)?\s*(\d+(?:\.\d+)?)\s*%\s*증가/;
    var consumeMatch = text.match(consumeStackPattern);
    if (consumeMatch) {
        var effectName7 = consumeMatch[3].trim().replace(/\s+/g, ' ');
        if (effectName7.includes('공격력')) effectName7 = '공격력 증가';
        else if (effectName7.includes('피해')) effectName7 = '피해량 증가';
        else effectName7 = effectName7 + ' 증가';

        result = {
            rawText: text.trim(),
            effects: [{
                effect: effectName7,
                value: parseFloat(consumeMatch[4]),
                unit: '%',
                dpsRelevant: DPS_EFFECTS.includes(effectName7)
            }],
            demerits: [],
            type: EFFECT_TYPE.TRIGGER,
            condition: [consumeMatch[1] + '중첩 소모 시'],
            duration: parseFloat(consumeMatch[2]),
            cooldown: null,
            stackInfo: {
                requiredStacks: parseInt(consumeMatch[1]),
                isConsumeStack: true
            },
            isLimited: false,
            classRestriction: null,
            consumeStack: true,
            doubleOnAwakening: false
        };
        return result;
    }

    return null; // 특수 패턴 없음
}

/**
 * 단일 효과 파싱
 * @updated 2025-12-11 - 특수 중첩 패턴 우선 체크
 */
function parseSingleEffect(text) {
    // ===================================================================
    // 특수 중첩 패턴 먼저 체크 @added 2025-12-11
    // ===================================================================
    var specialResult = parseSpecialStackingEffect(text);
    if (specialResult) {
        return specialResult;
    }

    var result = {
        rawText: text.trim(),
        effects: [],
        demerits: [],
        type: EFFECT_TYPE.PERMANENT,
        condition: null,
        duration: null,
        cooldown: null,
        stackInfo: null,
        isLimited: false,
        classRestriction: null, // @added 2025-12-10
        consumeStack: false, // 중첩 소모 여부
        doubleOnAwakening: false // 각성 시 두배 여부
    };

    // 제한적 효과 체크
    LIMITED_KEYWORDS.forEach(function(keyword) {
        if (text.includes(keyword)) {
            result.isLimited = true;
        }
    });

    // 클래스 제한 체크 @added 2025-12-10
    result.classRestriction = extractClassRestriction(text);

    // 중첩 소모 체크
    if (/중첩을?\s*(?:모두\s*)?소모/.test(text)) {
        result.consumeStack = true;
    }

    // 각성 시 두배 체크
    if (/각성\s*효과가?\s*활성화된?\s*동안.*두배/.test(text) || /두배가?\s*된다/.test(text)) {
        result.doubleOnAwakening = true;
    }

    // 조건 감지
    result.condition = detectCondition(text);

    // 지속 시간
    result.duration = extractDuration(text);

    // 쿨타임
    result.cooldown = extractCooldown(text);

    // 중첩 정보
    result.stackInfo = extractStackInfo(text);

    // 효과 타입 결정 @updated 2025-12-11
    // 우선순위: 누적/축적/중첩 > 트리거 > 상태조건 > 지속시간 > 상시
    // 중첩 효과는 조건(기본공격, 피격 등)과 관계없이 STACKING으로 분류

    // 1. 누적/축적/중첩 효과 (STACKING) - 최우선
    // 기본 공격 조건이어도 중첩 효과면 STACKING으로 분류
    var hasStackingPattern = result.stackInfo || /^누적\s*:|^축적\s*:/m.test(text) || /중첩된다|중첩됩니다|최대\s*\d+\s*회까지\s*중첩/.test(text);
    if (hasStackingPattern) {
        result.type = EFFECT_TYPE.STACKING;
        // 중첩 효과는 LIMITED 아님 (기본 공격 조건이어도)
        result.isLimited = false;
    }
    // 2. 트리거 조건 (공격, 스킬, 적중 등)
    else if (result.condition) {
        var triggerConditions = ['적중', '공격', '스킬', '사용', '시전', '처치', '피격'];
        var isTrigger = triggerConditions.some(function(keyword) {
            return result.condition.some(function(cond) {
                return cond.includes(keyword);
            });
        });

        // 상태 조건 (체력/자원/이동/거리 등) - 트리거가 아닌 경우
        var stateConditions = ['체력', '자원', '이동', '주변', '클래스 레벨', '적 없음'];
        var isStateCondition = stateConditions.some(function(keyword) {
            return result.condition.some(function(cond) {
                return cond.includes(keyword);
            });
        });

        if (isTrigger) {
            result.type = EFFECT_TYPE.TRIGGER;
        } else if (isStateCondition) {
            result.type = EFFECT_TYPE.STATE_CONDITION;
        } else {
            result.type = EFFECT_TYPE.TRIGGER;
        }
    }
    // 3. 제한적 효과 (LIMITED) - 효율 미반영
    else if (result.isLimited) {
        result.type = EFFECT_TYPE.LIMITED;
    }
    // 4. 지속 시간만 있는 경우
    else if (result.duration) {
        result.type = EFFECT_TYPE.DURATION;
    }
    // 5. 그 외는 상시 효과
    else {
        result.type = EFFECT_TYPE.PERMANENT;
    }

    // 효과 추출 패턴 @fixed 2025-12-10 - 구체적 패턴을 먼저, 일반 패턴을 나중에
    // 중복 방지: 연타/강타/추가타/스킬/치명타 피해는 일반 "피해량 증가"와 중복되지 않도록 순서 배치
    var effectPatterns = [
        // === 1. 공격력 관련 (최우선) ===
        {
            pattern: /공격력이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '공격력 증가',
            dps: true
        },
        // === 2. 구체적 피해 유형 (일반 피해량보다 먼저) ===
        {
            // 연타 피해 @fixed 2025-12-10
            pattern: /연타\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '연타 피해 증가',
            dps: true,
            excludeGeneric: true // 일반 피해량 증가에서 제외 플래그
        },
        {
            // 강타 피해 @fixed 2025-12-10
            pattern: /강타\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '강타 피해 증가',
            dps: true,
            excludeGeneric: true
        },
        {
            // 추가타 피해
            pattern: /추가타\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '추가타 피해 증가',
            dps: true,
            excludeGeneric: true
        },
        {
            // 스킬 피해
            pattern: /스킬\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '스킬 피해 증가',
            dps: true,
            excludeGeneric: true
        },
        {
            // 치명타 피해
            pattern: /치명타\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '치명타 피해 증가',
            dps: true,
            excludeGeneric: true
        },
        {
            // 멀티히트 피해
            pattern: /멀티히트\s*피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '멀티히트 피해 증가',
            dps: true,
            excludeGeneric: true
        },
        // === 3. 일반 피해량 증가 (구체적 유형 제외 후 적용) ===
        {
            // 일반 피해량 증가 - 앞에 연타/강타/추가타/스킬/치명타/멀티히트/주는/받는 이 없는 경우만
            // @updated 2025-12-11 - "주는 피해" 중복 방지
            pattern: /(?<!연타\s*)(?<!강타\s*)(?<!추가타\s*)(?<!스킬\s*)(?<!치명타\s*)(?<!멀티히트\s*)(?<!주는\s*)(?<!받는\s*)피해(?:량)?(?:가|이)?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '피해량 증가',
            dps: true
        },
        // === 4. 확률 관련 ===
        {
            pattern: /치명타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '치명타 확률 증가',
            dps: true
        },
        {
            pattern: /연타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '연타 확률 증가',
            dps: true
        },
        {
            pattern: /강타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '강타 확률 증가',
            dps: true
        },
        // === 5. 속도 관련 ===
        {
            pattern: /공격\s*속도가?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '공격 속도 증가',
            dps: false
        },
        {
            pattern: /캐스팅\s*속도가?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '캐스팅 속도 증가',
            dps: false
        },
        {
            pattern: /쿨타임\s*회복\s*속도가?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '쿨타임 회복 속도 증가',
            dps: false
        },
        {
            pattern: /재사용\s*대기\s*시간이?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '쿨타임 감소',
            dps: false
        },
        // 추가 효과 패턴 @added 2025-12-10
        {
            pattern: /방어력이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '방어력 증가',
            dps: false
        },
        {
            pattern: /이동\s*속도가?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '이동 속도 증가',
            dps: false
        },
        {
            pattern: /회복력이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '회복력 증가',
            dps: false
        },
        {
            pattern: /급소\s*회피\s*(?:확률이?)?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '급소 회피 증가',
            dps: false
        },
        {
            pattern: /차지\s*스킬의?\s*피해(?:량)?이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '차지 스킬 피해 증가',
            dps: true
        },
        {
            pattern: /스킬\s*위력이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '스킬 위력 증가',
            dps: true
        },
        {
            // 스킬 사용 속도가 8% 또는 스킬 사용 속도가 8%, 형태 @added 2025-12-10
            pattern: /스킬\s*사용\s*속도(?:가|와)?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '스킬 사용 속도 증가',
            dps: false
        },
        {
            // 캐스팅 및 차지 속도가 14% 형태 @added 2025-12-10
            pattern: /캐스팅\s*(?:및\s*)?차지\s*속도가?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '캐스팅/차지 속도 증가',
            dps: false
        },
        {
            // 재사용 대기 시간 회복 속도가 8% 증가 @added 2025-12-10
            pattern: /재사용\s*대기\s*시간\s*회복\s*속도가?\s*(\d+(?:\.\d+)?)\s*%(?:\s*증가)?/,
            name: '쿨타임 회복 속도 증가',
            dps: false
        },
        {
            pattern: /기본\s*공격\s*속도가?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '기본 공격 속도 증가',
            dps: false
        },
        {
            pattern: /기본\s*공격의?\s*추가타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '기본 공격 추가타 확률 증가',
            dps: false
        },
        // === 6. 타겟/적 관련 효과 @added 2025-12-11 ===
        {
            // 타겟이 받는 피해 증가 (디버프)
            pattern: /타겟(?:이|에게)?\s*(?:받는\s*)?피해(?:가|를)?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '타겟 받는 피해 증가',
            dps: true
        },
        {
            // 적이 받는 피해 증가 (디버프)
            pattern: /적(?:이|에게)?\s*(?:받는\s*)?피해(?:가|를)?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '적 받는 피해 증가',
            dps: true
        },
        {
            // 적에게 주는 피해 증가
            pattern: /적에게\s*주는\s*피해(?:가|가)?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '적에게 주는 피해 증가',
            dps: true
        },
        {
            // 주는 피해 증가
            pattern: /주는\s*피해(?:가|가)?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '주는 피해 증가',
            dps: true
        },
        // === 7. 받는 피해 관련 (자기 버프) @added 2025-12-11 ===
        {
            // 받는 피해 감소 (긍정 효과)
            pattern: /받는\s*피해(?:가|가)?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '받는 피해 감소',
            dps: false
        },
        // === 8. 추가타/연타/강타 확률 @added 2025-12-11 ===
        {
            pattern: /추가타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '추가타 확률 증가',
            dps: true
        },
        // === 9. 확률 발동 효과 @added 2025-12-11 ===
        {
            // N% 확률로 발동
            pattern: /(\d+(?:\.\d+)?)\s*%\s*확률로/,
            name: '확률 발동',
            dps: false,
            isMetaEffect: true // 메타 정보용
        },
        // === 10. 복합/특수 효과 @added 2025-12-11 ===
        {
            // "받는 피해와 주는 피해가 모두 N% 증가"
            pattern: /받는\s*피해와\s*주는\s*피해가?\s*모두\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '주는 피해 증가',
            dps: true
        },
        {
            // "받는 피해를 N% 증가시킨다" (타겟 디버프)
            pattern: /받는\s*피해를?\s*(\d+(?:\.\d+)?)\s*%\s*증가시킨다/,
            name: '타겟 받는 피해 증가',
            dps: true
        },
        {
            // "지속 피해: X를 준다" 패턴 (효과 있음 표시용)
            pattern: /지속\s*피해[:\s]*(화상|빙결|감전|출혈|중독|암흑|정신|신성)/,
            name: '지속 피해 부여',
            dps: false,
            isMetaEffect: true
        }
    ];

    // 결함 효과 패턴 @updated 2025-12-11 - "받는 피해 감소"는 결함이 아님
    var demeritPatterns = [{
            // "받는 피해 감소"가 아닌 "피해 감소"만 결함
            pattern: /(?<!받는\s*)피해(?:량)?가?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '피해량 감소'
        },
        {
            pattern: /멀티히트\s*피해(?:량)?(?:가|는)?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '멀티히트 피해 감소'
        },
        {
            pattern: /치명타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '치명타 확률 감소'
        },
        {
            pattern: /치명타\s*피해(?:량)?이?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '치명타 피해 감소'
        },
        {
            pattern: /공격력이?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '공격력 감소'
        },
        {
            pattern: /재사용\s*대기\s*시간\s*회복\s*속도가?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '쿨타임 회복 속도 감소'
        },
        {
            pattern: /스킬\s*사용\s*속도(?:와)?.*가?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '스킬 사용 속도 감소'
        },
        {
            pattern: /캐스팅(?:\s*및\s*차지)?\s*속도가?\s*(\d+(?:\.\d+)?)\s*%\s*감소/,
            name: '캐스팅 속도 감소'
        },
        {
            pattern: /이동\s*속도가?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/,
            name: '이동 속도 감소'
        },
        {
            pattern: /재사용\s*대기\s*시간이?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '쿨타임 증가'
        },
        {
            // 자신이 받는 피해 증가 (결함) - 명시적 "자신이"
            pattern: /자신이?\s*받는\s*피해가?\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '받는 피해 증가'
        },
        {
            // "받는 피해와 주는 피해가 모두 N% 증가" - 받는 피해 증가는 결함
            pattern: /받는\s*피해와\s*주는\s*피해가?\s*모두\s*(\d+(?:\.\d+)?)\s*%\s*증가/,
            name: '받는 피해 증가'
        }
    ];

    // 범위값 체크 @added 2025-12-10
    var rangeValue = parseRangeValue(text);
    if (rangeValue) {
        result.rangeValue = rangeValue;
    }

    // 효과 추출 @updated 2025-12-11 - 중첩 최대치 계산 추가
    effectPatterns.forEach(function(ep) {
        var m = text.match(ep.pattern);
        if (m) {
            var effectValue = parseFloat(m[1]);
            var effectEntry = {
                effect: ep.name,
                value: effectValue,
                unit: '%',
                dpsRelevant: ep.dps && !result.isLimited
            };

            // 범위값인 경우 추가 정보 저장 @added 2025-12-10
            if (rangeValue && rangeValue.average > effectValue) {
                effectEntry.rangeInfo = rangeValue;
                effectEntry.value = rangeValue.average; // 평균값 사용
            }

            // 중첩 효과인 경우 최대치 계산 @added 2025-12-11
            if (result.stackInfo && result.stackInfo.maxStacks && !ep.isMetaEffect) {
                effectEntry.stackValue = effectValue;
                effectEntry.maxStacks = result.stackInfo.maxStacks;
                effectEntry.value = effectValue * result.stackInfo.maxStacks;
            }

            result.effects.push(effectEntry);
        }
    });

    // 결함 추출
    demeritPatterns.forEach(function(dp) {
        var m = text.match(dp.pattern);
        if (m) {
            result.demerits.push({
                effect: dp.name,
                value: parseFloat(m[1]),
                unit: '%'
            });
        }
    });

    return result;
}

/**
 * 룬 전체 효과 파싱
 */
function parseRuneEffects(rune) {
    var text = stripHtml(rune.description);
    var parsedEffects = [];
    var allDemerits = [];
    var decayEffect = null;
    var awakeningEffect = null;

    // ===================================================================
    // 강화 효과 텍스트 먼저 제거 @added 2025-12-11
    // 강화 효과는 별도로 파싱되므로 본문에서 제거하여 중복 방지
    // ===================================================================
    text = text.replace(/장비를?\s*\+10\s*강화\s*시[,:\s]*[^.\n]+[.]/g, '');
    text = text.replace(/장비를?\s*\+15\s*강화\s*시[,:\s]*[^.\n]+[.]/g, '');
    text = text.replace(/장비를?\s*\+10[,\s]*\+15\s*강화\s*시\s*각각[^.\n]+[.]/g, '');
    text = text.replace(/\+10\s*강화\s*시[,:\s]*[^.\n]+[.]/g, '');
    text = text.replace(/\+15\s*강화\s*시(?:에는)?[,:\s]*[^.\n]+[.]/g, '');

    // 시간 감소 효과 먼저 체크
    decayEffect = parseDecayEffect(text);
    if (decayEffect) {
        parsedEffects.push({
            type: EFFECT_TYPE.DECAY,
            condition: ['전투 시작 시'],
            effects: [{
                effect: '공격력 증가',
                value: decayEffect.initialValue,
                effectiveValue: decayEffect.effectiveValue,
                unit: '%',
                dpsRelevant: true
            }],
            decayInfo: {
                interval: decayEffect.interval,
                decayRate: decayEffect.decayRate,
                decayDuration: decayEffect.decayDuration
            }
        });
        // 감소 효과 텍스트 제거
        text = text.replace(decayEffect.rawText, '');
    }

    // 전체 텍스트에서 쿨타임 먼저 추출 @fixed 2025-12-10
    var globalCooldown = extractCooldown(text);

    // 엠블럼 각성 효과 체크
    if (rune.category === '04') {
        awakeningEffect = parseAwakeningEffect(text, rune);
        if (awakeningEffect) {
            // 각성 효과에 쿨타임 적용 (기본 90초)
            awakeningEffect.cooldown = globalCooldown || 90;
            parsedEffects.push(awakeningEffect);
            // 각성 효과 부분 제거 (중복 파싱 방지) @fixed 2025-12-10
            // 패턴 1: "공격 시 N% 확률로 각성하여 M초 동안 ..."
            text = text.replace(/공격\s*시[,.\s]*\d+(?:\.\d+)?\s*%\s*확률로\s*각성하여\s*\d+(?:\.\d+)?\s*초\s*동안[^.]*?(?:증가한다|된다|발생한다)[.]?/g, '');
            // 패턴 2: "무방비 공격 시 각성하여 M초 동안 ..."
            text = text.replace(/무방비\s*공격\s*시[,.\s]*각성하여\s*\d+(?:\.\d+)?\s*초\s*동안[^.]*?(?:증가한다|된다|초기화)[.]?/g, '');
        }
    }

    // 문장 분리 (개행 또는 마침표 기준) @fixed 2025-12-10
    // 1. 줄바꿈으로 먼저 분리
    // 2. "다." 또는 "다)" 패턴으로 분리
    var sentences = text.split(/\n|(?<=다)\./);

    // 추가 분리: "상시 효과:" 앞에서도 분리
    var expandedSentences = [];
    sentences.forEach(function(s) {
        if (s.includes('상시 효과:')) {
            var parts = s.split(/(?=상시\s*효과\s*:)/);
            expandedSentences = expandedSentences.concat(parts);
        } else {
            expandedSentences.push(s);
        }
    });
    sentences = expandedSentences;

    sentences.forEach(function(sentence) {
        sentence = sentence.trim();
        if (!sentence || sentence.length < 5) return;

        // 결함 섹션 체크
        if (/^결함\s*:/.test(sentence)) {
            var demeritText = sentence.replace(/^결함\s*:/, '').trim();
            var demeritParsed = parseSingleEffect(demeritText);
            if (demeritParsed.demerits.length > 0) {
                allDemerits = allDemerits.concat(demeritParsed.demerits);
            }
            return;
        }

        // 일반 효과 파싱
        var parsed = parseSingleEffect(sentence);
        if (parsed.effects.length > 0 || parsed.demerits.length > 0) {
            // 글로벌 쿨타임 적용 @added 2025-12-11
            if (globalCooldown && !parsed.cooldown) {
                parsed.cooldown = globalCooldown;
            }
            parsedEffects.push(parsed);
            if (parsed.demerits.length > 0) {
                allDemerits = allDemerits.concat(parsed.demerits);
            }
        }
    });

    // 클래스 제한 추출 @added 2025-12-11
    var classRestriction = extractClassRestriction(stripHtml(rune.description));

    return {
        effects: parsedEffects,
        demerits: allDemerits,
        cooldown: globalCooldown,
        classRestriction: classRestriction
    };
}

/**
 * 강화 효과 파싱
 * @updated 2025-12-10 - 다양한 강화 패턴 처리
 */
function parseEnhanceEffects(text) {
    var enhance10 = {};
    var enhance15 = {};

    // 패턴 1: "장비를 +10 강화 시, 효과. +15 강화 시, 효과."
    var pattern1_10 = text.match(/장비를?\s*\+10\s*강화\s*시[,:]?\s*([^.]+)/);
    var pattern1_15 = text.match(/\+15\s*강화\s*시[,:]?\s*([^.]+)/);

    // 패턴 2: "장비를 +10, +15 강화 시 각각 효과가 N% 추가로 증가"
    var pattern2 = text.match(/장비를?\s*\+10[,\s]*\+15\s*강화\s*시\s*각각\s*([^.]+)/);

    // 패턴 3: "+10 강화시, 효과. +15 강화시에는 효과 더 증가"
    var pattern3_10 = text.match(/\+10\s*강화\s*시[,:]?\s*([^.]+)/);
    var pattern3_15 = text.match(/\+15\s*강화\s*시에는?\s*([^.]+)/);

    if (pattern2) {
        // 각각 동일한 증가량
        var effectText = pattern2[1];
        var valueMatch = effectText.match(/(\d+(?:\.\d+)?)\s*%\s*추가/);
        if (valueMatch) {
            var value = parseFloat(valueMatch[1]);
            if (/피해/.test(effectText)) {
                enhance10['피해량 증가'] = value;
                enhance15['피해량 증가'] = value;
            }
            if (/공격력/.test(effectText)) {
                enhance10['공격력 증가'] = value;
                enhance15['공격력 증가'] = value;
            }
        }
    } else {
        // +10 효과
        var match10Text = pattern1_10 ? pattern1_10[1] : (pattern3_10 ? pattern3_10[1] : null);
        if (match10Text) {
            var parsed10 = parseSingleEffect(match10Text);
            parsed10.effects.forEach(function(e) {
                enhance10[e.effect] = e.value;
            });
        }

        // +15 효과
        var match15Text = pattern1_15 ? pattern1_15[1] : (pattern3_15 ? pattern3_15[1] : null);
        if (match15Text) {
            // "N% 더 증가" 패턴 처리
            var moreMatch = match15Text.match(/(\d+(?:\.\d+)?)\s*%\s*더\s*증가/);
            if (moreMatch) {
                // +10 효과에 추가
                Object.keys(enhance10).forEach(function(key) {
                    enhance15[key] = parseFloat(moreMatch[1]);
                });
            } else {
                var parsed15 = parseSingleEffect(match15Text);
                parsed15.effects.forEach(function(e) {
                    enhance15[e.effect] = e.value;
                });
            }
        }
    }

    return {
        '10': enhance10,
        '15': enhance15
    };
}

/**
 * 상태 조건 업타임 계산
 * @added 2025-12-10
 */
function calculateStateUptime(condition) {
    // 조건별 예상 업타임 (%)
    var uptimeMap = {
        '체력 75% 이상': 70,
        '체력 50% 이상': 85,
        '체력 50% 이하': 15,
        '체력 30% 이하': 5,
        '자원 50% 미만': 30,
        '자원 50% 이상': 70,
        '클래스 레벨': 100, // 달성하면 상시
        '이동 안함': 20, // 레이드에서 낮음
        '적 없음': 40, // 궁수 원거리
        '적 수 비례': 60, // 평균 효과
        '피해 받으면 초기화': 50, // 피격 빈도에 따라
        '적 처치 시': 30 // 보스전에서 낮음
    };

    for (var key in uptimeMap) {
        if (condition.includes(key)) {
            return uptimeMap[key];
        }
    }
    return 80; // 기본값
}

/**
 * 직업별 기본 티어 계산
 * @updated 2025-12-10 - 더 세분화된 티어 계산
 */
function calculateClassTier(rune, parsedEffects) {
    var classTier = {};

    // 직업 그룹 정의
    var classGroups = {
        '전사계열': ['전사', '검술사', '대검전사'],
        '궁수계열': ['궁수', '석궁사수', '장궁병'],
        '힐러계열': ['힐러', '사제', '수도사', '암흑술사'],
        '마법사계열': ['마법사', '화염술사', '빙결술사', '전격술사'],
        '도적계열': ['도적', '듀얼블레이드', '격투가'],
        '음유시인계열': ['음유시인', '댄서', '악사']
    };

    // 특성 분석
    var features = {
        hasBasicAttackEffect: false,
        hasCooldownReduction: false,
        hasStrongHitEffect: false, // 강타
        hasMultiHitEffect: false, // 연타
        hasAdditionalHitEffect: false, // 추가타
        hasCritEffect: false, // 치명타
        hasHealEffect: false, // 회복
        hasSupportSkillEffect: false, // 보조 스킬
        hasDistanceCondition: false, // 거리 조건
        hasDotSynergy: false, // 도트 연계
        hasFinishAttack: false, // 피니시 어택
        hasCounterAttack: false // 카운터 공격
    };

    parsedEffects.effects.forEach(function(e) {
        if (e.condition) {
            e.condition.forEach(function(cond) {
                if (cond.includes('기본 공격')) features.hasBasicAttackEffect = true;
                if (cond.includes('강타')) features.hasStrongHitEffect = true;
                if (cond.includes('연타')) features.hasMultiHitEffect = true;
                if (cond.includes('추가타')) features.hasAdditionalHitEffect = true;
                if (cond.includes('치명타')) features.hasCritEffect = true;
                if (cond.includes('회복')) features.hasHealEffect = true;
                if (cond.includes('보조') || cond.includes('방해')) features.hasSupportSkillEffect = true;
                if (cond.includes('거리') || cond.includes('범위') || cond.includes('적 없음')) features.hasDistanceCondition = true;
                if (cond.includes('지속 피해')) features.hasDotSynergy = true;
                if (cond.includes('피니시')) features.hasFinishAttack = true;
                if (cond.includes('카운터')) features.hasCounterAttack = true;
            });
        }
        if (e.effects) {
            e.effects.forEach(function(eff) {
                if (eff.effect.includes('쿨타임') || eff.effect.includes('재사용')) {
                    features.hasCooldownReduction = true;
                }
            });
        }
    });

    // 각 직업별 티어 계산
    var allClasses = [];
    Object.values(classGroups).forEach(function(group) {
        allClasses = allClasses.concat(group);
    });

    allClasses.forEach(function(cls) {
        var tier = 'B'; // 기본
        var score = 0;

        // 도적 계열
        if (classGroups['도적계열'].indexOf(cls) !== -1) {
            if (features.hasBasicAttackEffect) score += 3;
            if (features.hasCooldownReduction) score += 2;
            if (features.hasMultiHitEffect) score += 2;
            if (features.hasAdditionalHitEffect) score += 1;
        }

        // 수도사 (힐러 계열이지만 도적과 유사)
        if (cls === '수도사') {
            if (features.hasBasicAttackEffect) score += 3;
            if (features.hasCooldownReduction) score += 2;
            if (features.hasStrongHitEffect) score += 1;
        }

        // 전사 계열
        if (classGroups['전사계열'].indexOf(cls) !== -1) {
            if (features.hasStrongHitEffect) score += 3;
            if (features.hasCounterAttack) score += 2;
            if (features.hasFinishAttack) score += 1;
        }

        // 궁수 계열
        if (classGroups['궁수계열'].indexOf(cls) !== -1) {
            if (features.hasDistanceCondition) score += 3;
            if (features.hasCritEffect) score += 2;
            if (features.hasAdditionalHitEffect) score += 1;
        }

        // 마법사 계열
        if (classGroups['마법사계열'].indexOf(cls) !== -1) {
            if (features.hasDotSynergy) score += 3;
            if (features.hasCritEffect) score += 2;
        }

        // 힐러 계열 (수도사 제외)
        if (classGroups['힐러계열'].indexOf(cls) !== -1 && cls !== '수도사') {
            if (features.hasHealEffect) score += 3;
            if (features.hasSupportSkillEffect) score += 2;
        }

        // 음유시인 계열
        if (classGroups['음유시인계열'].indexOf(cls) !== -1) {
            if (features.hasSupportSkillEffect) score += 2;
        }

        // 점수 → 티어 변환
        if (score >= 5) tier = 'S';
        else if (score >= 3) tier = 'A';
        else if (score >= 1) tier = 'B';
        else tier = 'C';

        classTier[cls] = tier;
    });

    return classTier;
}

/**
 * 태그 생성
 * @updated 2025-12-10 - 다양한 조건/효과 태그 추가
 */
function generateTags(parsedEffects) {
    var tags = [];

    parsedEffects.effects.forEach(function(e) {
        // 조건 기반 태그
        if (e.condition) {
            e.condition.forEach(function(cond) {
                // 공격 타입
                if (cond.includes('기본 공격')) tags.push('기본공격연계');
                if (cond.includes('스킬 사용') || cond.includes('스킬/기본')) tags.push('스킬사용');
                if (cond.includes('강타')) tags.push('강타');
                if (cond.includes('연타')) tags.push('연타');
                if (cond.includes('추가타')) tags.push('추가타');
                if (cond.includes('치명타')) tags.push('치명타');
                if (cond.includes('피니시')) tags.push('피니시어택');
                if (cond.includes('카운터')) tags.push('카운터');

                // 특수 조건
                if (cond.includes('전투 시작')) tags.push('전투시작');
                if (cond.includes('전투 중')) tags.push('전투중');
                if (cond.includes('보조') || cond.includes('방해') || cond.includes('생존')) tags.push('보조스킬');
                if (cond.includes('회복')) tags.push('회복');
                if (cond.includes('적 처치')) tags.push('적처치');

                // 상태 조건
                if (cond.includes('체력')) tags.push('체력조건');
                if (cond.includes('자원')) tags.push('자원조건');
                if (cond.includes('클래스 레벨')) tags.push('클래스레벨');
                if (cond.includes('이동')) tags.push('이동조건');
                if (cond.includes('거리') || cond.includes('범위') || cond.includes('적 없음')) tags.push('거리조건');
                if (cond.includes('지속 피해')) tags.push('도트연계');

                // 제한적 조건
                if (cond.includes('무방비')) tags.push('무방비');
                if (cond.includes('브레이크')) tags.push('브레이크');
                if (cond.includes('궁극기') || cond.includes('각성/궁극기')) tags.push('궁극기');
                if (cond.includes('확률')) tags.push('확률발동');

                // 추가 조건 @added 2025-12-10
                if (cond.includes('도발')) tags.push('도발');
                if (cond.includes('가방')) tags.push('가방무게');
                if (cond.includes('전력') || cond.includes('충전')) tags.push('전력시스템');
                if (cond.includes('과부하')) tags.push('과부하');
                if (cond.includes('파티')) tags.push('파티플레이');
                if (cond.includes('각인')) tags.push('각인시너지');
                if (cond.includes('중첩 도달') || cond.includes('중첩 시')) tags.push('중첩소모');

                // 추가 조건 2차 @added 2025-12-10
                if (cond.includes('전투 종료')) tags.push('전투종료까지');
                if (cond.includes('음식') || cond.includes('배고픈')) tags.push('음식상태');
                if (cond.includes('보호막')) tags.push('보호막');
                if (cond.includes('포션')) tags.push('포션');
                if (cond.includes('회 공격마다')) tags.push('연속공격');
                if (cond.includes('스킬 변환')) tags.push('스킬변환');
                if (cond.includes('각인')) tags.push('각인위치');
                if (cond.includes('적 체력')) tags.push('적체력조건');
            });
        }

        // 효과 기반 태그
        if (e.effects) {
            e.effects.forEach(function(eff) {
                if (eff.effect.includes('공격력')) tags.push('공격력');
                if (eff.effect.includes('피해량') || eff.effect.includes('피해 증가')) tags.push('피해량');
                if (eff.effect.includes('치명타 확률')) tags.push('치명타확률');
                if (eff.effect.includes('치명타 피해')) tags.push('치명타피해');
                if (eff.effect.includes('쿨타임') || eff.effect.includes('재사용')) tags.push('쿨감');
                if (eff.effect.includes('연타') || eff.effect.includes('강타') || eff.effect.includes('추가타')) {
                    tags.push('멀티히트');
                }
                if (eff.effect.includes('공격 속도') || eff.effect.includes('캐스팅')) tags.push('속도');
                if (eff.effect.includes('스킬 피해')) tags.push('스킬피해');
            });
        }

        // 효과 타입 기반 태그
        if (e.type === EFFECT_TYPE.STACKING) tags.push('누적');
        if (e.type === EFFECT_TYPE.AWAKENING) tags.push('각성');
        if (e.type === EFFECT_TYPE.DECAY) tags.push('시간감소');
        if (e.type === EFFECT_TYPE.STATE_CONDITION) tags.push('상태조건');
        if (e.type === EFFECT_TYPE.LIMITED) tags.push('제한적');

        // 특수 정보
        if (e.stackInfo && e.stackInfo.isIndependentDuration) tags.push('독립지속');
        if (e.stackInfo && e.stackInfo.resetCondition) tags.push('조건해제');

        // 클래스 제한 @added 2025-12-10
        if (e.classRestriction) tags.push(e.classRestriction);

        // 특수 효과 @added 2025-12-10
        if (e.consumeStack) tags.push('중첩소모');
        if (e.doubleOnAwakening) tags.push('각성두배');
    });

    // 결함 태그
    if (parsedEffects.demerits.length > 0) tags.push('결함');

    // 중복 제거 및 정렬
    var uniqueTags = [];
    tags.forEach(function(tag) {
        if (uniqueTags.indexOf(tag) === -1) {
            uniqueTags.push(tag);
        }
    });
    return uniqueTags.sort();
}

// ============================================================
// 메인 처리
// ============================================================

function main() {
    console.log('='.repeat(60));
    console.log('룬 효과 파싱 시작');
    console.log('='.repeat(60));

    // runes.json 로드
    var runesPath = path.join(__dirname, 'runes.json');
    var runesData = JSON.parse(fs.readFileSync(runesPath, 'utf8'));

    console.log('총 룬 수:', runesData.length);

    var parsedRunes = [];
    var stats = {
        total: 0,
        included: 0,
        excluded: 0,
        byGrade: {},
        byCategory: {},
        withDemerits: 0,
        withAwakening: 0,
        withDecay: 0
    };

    runesData.forEach(function(rune, index) {
        stats.total++;

        // 등급 필터링
        var gradeInfo = getGradeInfo(rune.grade, rune.stars);
        if (!gradeInfo) {
            stats.excluded++;
            return;
        }

        stats.included++;

        // 통계
        var gradeKey = gradeInfo.name;
        stats.byGrade[gradeKey] = (stats.byGrade[gradeKey] || 0) + 1;

        var categoryName = CATEGORY_MAP[rune.category] || '기타';
        stats.byCategory[categoryName] = (stats.byCategory[categoryName] || 0) + 1;

        // 효과 파싱
        var parsedEffects = parseRuneEffects(rune);
        var enhanceEffects = parseEnhanceEffects(rune.description);
        var classTier = calculateClassTier(rune, parsedEffects);
        var tags = generateTags(parsedEffects);

        // 통계 업데이트
        if (parsedEffects.demerits.length > 0) stats.withDemerits++;
        if (parsedEffects.effects.some(function(e) {
                return e.type === EFFECT_TYPE.AWAKENING;
            })) stats.withAwakening++;
        if (parsedEffects.effects.some(function(e) {
                return e.type === EFFECT_TYPE.DECAY;
            })) stats.withDecay++;

        // 파싱된 룬 객체 생성 @updated 2025-12-11 - classRestriction, cooldown 추가
        var parsedRune = {
            id: rune.id,
            name: rune.name,
            category: rune.category,
            categoryName: categoryName,
            grade: rune.grade,
            stars: rune.stars,
            gradeName: gradeInfo.name,
            gradeColor: gradeInfo.color,
            gradePriority: gradeInfo.priority,
            klass: rune.klass,
            image: rune.image,
            rawDescription: rune.description,
            effects: parsedEffects.effects,
            demerits: parsedEffects.demerits,
            enhanceEffects: enhanceEffects,
            classRestriction: parsedEffects.classRestriction || null, // @added 2025-12-11
            cooldown: parsedEffects.cooldown || null, // @added 2025-12-11
            classTier: classTier,
            tags: tags,
            synergies: [] // 추후 수동 입력
        };

        parsedRunes.push(parsedRune);

        // 진행 상황 출력 (100개마다)
        if ((index + 1) % 100 === 0) {
            console.log('처리 중...', index + 1, '/', runesData.length);
        }
    });

    // 결과 저장
    var output = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString().split('T')[0],
        stats: stats,
        runes: parsedRunes
    };

    var outputPath = path.join(__dirname, 'runes-parsed.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

    console.log('\n' + '='.repeat(60));
    console.log('파싱 완료!');
    console.log('='.repeat(60));
    console.log('\n통계:');
    console.log('- 전체 룬:', stats.total);
    console.log('- 포함된 룬:', stats.included);
    console.log('- 제외된 룬:', stats.excluded);
    console.log('\n등급별:');
    Object.keys(stats.byGrade).forEach(function(grade) {
        console.log('  -', grade + ':', stats.byGrade[grade]);
    });
    console.log('\n카테고리별:');
    Object.keys(stats.byCategory).forEach(function(cat) {
        console.log('  -', cat + ':', stats.byCategory[cat]);
    });
    console.log('\n특수 효과:');
    console.log('- 결함 효과 보유:', stats.withDemerits);
    console.log('- 각성 효과 보유:', stats.withAwakening);
    console.log('- 시간 감소 효과:', stats.withDecay);
    console.log('\n출력 파일:', outputPath);
}

// 실행
main();