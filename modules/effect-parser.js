/**
 * ============================================
 * 효과 파싱 엔진 모듈
 * ============================================
 * @file        modules/effect-parser.js
 * @description 룬 효과 텍스트 파싱 및 수치 추출
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.EffectParser)
 * - 룬 효과 텍스트를 파싱하여 구조화된 데이터로 변환
 * 
 * @requires Utils (modules/utils.js)
 * @requires EffectTypes (constants/effect-types.js)
 * 
 * @structure
 * 1. 상수 정의
 * 2. 엠블럼 각성 파싱
 * 3. 효과 수치 파싱
 * 4. 효과 유형 분류
 * 5. 강화 효과 파싱
 * 6. 시너지/도트 효과 파싱
 */

(function() {
    'use strict';

    // ============================================
    // 외부 모듈 참조
    // ============================================
    
    // 유틸리티 함수 참조
    function stripHtml(html) {
        if (window.Utils && window.Utils.stripHtml) {
            return window.Utils.stripHtml(html);
        }
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

// ============================================
// 9. 고급 효과 파싱 엔진 (Advanced Effect Parser)
// ============================================
// @updated 2025-12-10 - 효과 유형 분류, 중첩, 업타임 비율 계산 추가

/**
 * 효과 유형 상수
 * @constant {Object}
 */
const EFFECT_TYPE = {
    PASSIVE: 'passive', // 상시 효과 (100%)
    TRIGGER: 'trigger', // 트리거 효과 (80%)
    STACKING: 'stacking', // 누적/축적 효과 (95%) @added 2025-12-10
    STATE_CONDITION: 'state', // 상태 조건 효과 (70%)
    ENEMY_CONDITION: 'enemy', // 적 상태 조건 (시너지 의존)
    ENHANCEMENT: 'enhance' // 강화 단계별 효과
};

/**
 * 효과 유형별 가중치
 * @constant {Object}
 */
const EFFECT_TYPE_WEIGHT = {
    [EFFECT_TYPE.PASSIVE]: 1.0, // 100%
    [EFFECT_TYPE.TRIGGER]: 0.8, // 80%
    [EFFECT_TYPE.STACKING]: 0.95, // 95% - 누적/축적 효과는 쉽게 최대 중첩 유지 @added 2025-12-10
    [EFFECT_TYPE.STATE_CONDITION]: 0.7, // 70%
    [EFFECT_TYPE.ENEMY_CONDITION]: 0.5, // 50% (시너지 없을 때)
    [EFFECT_TYPE.ENHANCEMENT]: 1.0 // 100% (강화 조건 충족 시)
};

/**
 * 엠블럼 각성 기본 쿨타임 (초)
 * @constant {number}
 * @added 2025-12-10
 */
const EMBLEM_AWAKENING_BASE_COOLDOWN = 90;

/**
 * 엠블럼 각성 효과 파싱
 * @param {string} description - 룬 설명
 * @returns {Object|null} { duration, cooldown, passiveEffects, awakeningEffects }
 * @description 엠블럼 각성 효과는 쿨타임 기반 업타임으로 계산
 *              발동 확률(50%)은 쿨타임 후 첫 공격 시 발동 여부이므로
 *              평균 1~2회 공격 내 발동 → 업타임에 큰 영향 없음
 * @updated 2025-12-10 - 발동 확률을 업타임 계산에서 제외
 */
function parseEmblemAwakening(description) {
    if (!description) return null;

    var text = stripHtml(description);
    var result = {
        hasAwakening: false,
        duration: 0,
        cooldown: EMBLEM_AWAKENING_BASE_COOLDOWN,
        // 발동 확률은 업타임 계산에 미포함 (쿨타임 후 거의 즉시 발동)
        passiveEffects: {},
        awakeningEffects: {}
    };

    // 각성 패턴: "공격 시 N% 확률로 각성하여 N초 동안"
    var awakeningPattern = /(\d+)%\s*확률로\s*각성하여\s*(\d+)초\s*동안/;
    var awakeningMatch = text.match(awakeningPattern);

    if (awakeningMatch) {
        result.hasAwakening = true;
        // 발동 확률은 저장만 하고 업타임 계산에는 사용하지 않음
        result.triggerChance = parseInt(awakeningMatch[1]) / 100;
        result.duration = parseInt(awakeningMatch[2]);
    }

    // 무방비 각성 패턴: "무방비 공격 시 각성하여 N초 동안" - 제한적 효과로 분류
    var defenseBreakPattern = /무방비\s*공격\s*시\s*각성하여\s*(\d+)초\s*동안/;
    var defenseBreakMatch = text.match(defenseBreakPattern);

    if (defenseBreakMatch) {
        result.hasAwakening = true;
        result.isDefenseBreakAwakening = true; // 무방비 각성은 제한적
        result.duration = parseInt(defenseBreakMatch[1]);
    }

    // 쿨타임 패턴: "(재사용 대기 시간: N초)"
    var cooldownPattern = /재사용\s*대기\s*시간[:\s]*(\d+)초/;
    var cooldownMatch = text.match(cooldownPattern);

    if (cooldownMatch) {
        result.cooldown = parseInt(cooldownMatch[1]);
    }

    // 상시 효과 파싱: "상시 효과:" 이후 문장
    var passivePattern = /상시\s*효과[:\s]*(.*?)(?:\.|$)/;
    var passiveMatch = text.match(passivePattern);

    if (passiveMatch) {
        result.passiveEffects = parseEffectValues(passiveMatch[1]);
    }

    // 각성 중 효과 파싱 (각성하여 ~ 증가한다 사이)
    if (result.hasAwakening) {
        var awakeningEffectPattern = /각성하여\s*\d+초\s*동안\s*(.*?)(?:\.|재사용)/;
        var awakeningEffectMatch = text.match(awakeningEffectPattern);

        if (awakeningEffectMatch) {
            var awakeningEffectText = awakeningEffectMatch[1];

            // 기본 공격 관련 각성인지 체크 @added 2025-12-10
            if (/기본\s*공격/.test(awakeningEffectText)) {
                result.isBasicAttackAwakening = true;
            }

            result.awakeningEffects = parseEffectValues(awakeningEffectText);
        }
    }

    return result.hasAwakening ? result : null;
}

/**
 * 효과 문자열에서 수치 파싱
 * @param {string} effectText - 효과 텍스트
 * @returns {Object} 파싱된 효과
 * @added 2025-12-10
 */
/**
 * 효과 문자열에서 수치 파싱
 * @param {string} effectText - 효과 텍스트
 * @returns {Object} 파싱된 효과
 * @updated 2025-12-10 - 엠블럼 각성 효과 전체 검수 반영
 */
function parseEffectValues(effectText) {
    var effects = {};

    // 공격력 증가
    var atkMatch = effectText.match(/공격력이?\s*(\d+(?:\.\d+)?)\s*%/);
    if (atkMatch) effects['공격력 증가'] = parseFloat(atkMatch[1]);

    // 피해량 증가 (일반)
    var dmgMatch = effectText.match(/(?:적에게\s*)?주는\s*피해가?\s*(\d+(?:\.\d+)?)\s*%/);
    if (dmgMatch) effects['피해량 증가'] = parseFloat(dmgMatch[1]);

    // 스킬 피해 증가 @added 2025-12-10
    var skillDmgMatch = effectText.match(/스킬\s*피해가?\s*(\d+(?:\.\d+)?)\s*%/);
    if (skillDmgMatch) effects['스킬 피해 증가'] = parseFloat(skillDmgMatch[1]);

    // 치명타 확률
    var critChanceMatch = effectText.match(/치명타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%/);
    if (critChanceMatch) effects['치명타 확률 증가'] = parseFloat(critChanceMatch[1]);

    // 치명타 피해
    var critDmgMatch = effectText.match(/치명타\s*피해(?:량)?이?\s*(\d+(?:\.\d+)?)\s*%/);
    if (critDmgMatch) effects['치명타 피해 증가'] = parseFloat(critDmgMatch[1]);

    // 강타 피해 @added 2025-12-10
    var heavyHitMatch = effectText.match(/강타\s*피해가?\s*(\d+(?:\.\d+)?)\s*%/);
    if (heavyHitMatch) effects['강타 피해 증가'] = parseFloat(heavyHitMatch[1]);

    // 강타 확률 @added 2025-12-10
    var heavyChanceMatch = effectText.match(/강타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%/);
    if (heavyChanceMatch) effects['강타 확률 증가'] = parseFloat(heavyChanceMatch[1]);

    // 연타 피해 @added 2025-12-10
    var multiHitDmgMatch = effectText.match(/연타\s*피해가?\s*(\d+(?:\.\d+)?)\s*%/);
    if (multiHitDmgMatch) effects['연타 피해 증가'] = parseFloat(multiHitDmgMatch[1]);

    // 연타 확률 @added 2025-12-10
    var multiHitMatch = effectText.match(/연타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%/);
    if (multiHitMatch) effects['연타 확률 증가'] = parseFloat(multiHitMatch[1]);

    // 추가타 확률 @added 2025-12-10
    var extraHitMatch = effectText.match(/추가타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%/);
    if (extraHitMatch) effects['추가타 확률 증가'] = parseFloat(extraHitMatch[1]);

    // 스킬 사용 속도 @added 2025-12-10
    var skillSpeedMatch = effectText.match(/스킬\s*사용\s*속도가?\s*(\d+(?:\.\d+)?)\s*%/);
    if (skillSpeedMatch) effects['스킬 사용 속도 증가'] = parseFloat(skillSpeedMatch[1]);

    // 캐스팅/차지 속도 @added 2025-12-10
    var castSpeedMatch = effectText.match(/캐스팅\s*(?:및\s*)?(?:차지\s*)?속도가?\s*(\d+(?:\.\d+)?)\s*%/);
    if (castSpeedMatch) effects['캐스팅 속도 증가'] = parseFloat(castSpeedMatch[1]);

    // 재사용 대기 시간 회복 속도 @added 2025-12-10
    var cooldownRecoveryMatch = effectText.match(/재사용\s*대기\s*(?:시간\s*)?회복\s*속도가?\s*(\d+(?:\.\d+)?)\s*%/);
    if (cooldownRecoveryMatch) effects['쿨타임 회복 속도 증가'] = parseFloat(cooldownRecoveryMatch[1]);

    // 재사용 대기 시간 감소 @added 2025-12-10
    var cooldownReduceMatch = effectText.match(/재사용\s*대기\s*시간이?\s*(\d+(?:\.\d+)?)\s*%\s*감소/);
    if (cooldownReduceMatch) effects['쿨타임 감소'] = parseFloat(cooldownReduceMatch[1]);

    return effects;
}

/**
 * 방어구 룬에서 각성 쿨타임 감소량 파싱
 * @param {Object} rune - 룬 데이터
 * @returns {number} 쿨타임 감소량 (초)
 * @added 2025-12-10
 */
function parseAwakeningCooldownReduction(rune) {
    if (!rune || !rune.description) return 0;
    if (rune.category !== '02') return 0; // 방어구만

    var text = stripHtml(rune.description);

    // 패턴: "각성의 재사용 대기 시간이 N초 감소"
    var pattern = /각성의?\s*재사용\s*대기\s*시간이?\s*(\d+)초\s*감소/;
    var match = text.match(pattern);

    if (match) {
        return parseInt(match[1]);
    }

    return 0;
}

/**
 * 장착된 방어구에서 총 각성 쿨타임 감소량 계산
 * @returns {number} 총 쿨타임 감소량 (초)
 * @added 2025-12-10
 */
function getTotalAwakeningCooldownReduction() {
    var totalReduction = 0;

    Object.values(state.equippedRunes).forEach(function(rune) {
        if (rune) {
            totalReduction += parseAwakeningCooldownReduction(rune);
        }
    });

    return totalReduction;
}

/**
 * 엠블럼 각성 업타임 계산
 * @param {Object} emblemRune - 엠블럼 룬
 * @param {number} cooldownReduction - 쿨타임 감소량
 * @returns {number} 업타임 비율 (0~1)
 * @added 2025-12-10
 */
/**
 * 엠블럼 각성 업타임 계산
 * @param {Object} emblemRune - 엠블럼 룬
 * @param {number} cooldownReduction - 쿨타임 감소량
 * @returns {number} 업타임 비율 (0~1)
 * @description 업타임 = 지속시간 / (지속시간 + 쿨타임)
 *              발동 확률은 쿨타임 후 첫 공격 시 발동 여부이므로 업타임에 미포함
 *              (평균 1~2회 공격 내 발동하므로 거의 즉시 발동)
 * @updated 2025-12-10
 */
function calculateAwakeningUptime(emblemRune, cooldownReduction) {
    var awakening = parseEmblemAwakening(emblemRune.description);

    if (!awakening || !awakening.hasAwakening) return 0;

    // 무방비 각성은 제한적 효과로 업타임 0 처리
    if (awakening.isDefenseBreakAwakening) return 0;

    var effectiveCooldown = Math.max(awakening.cooldown - cooldownReduction, 10); // 최소 10초

    // 업타임 = 지속시간 / (지속시간 + 쿨타임)
    // 발동 확률은 업타임에 미포함 (쿨타임 후 거의 즉시 발동)
    var uptime = awakening.duration / (awakening.duration + effectiveCooldown);

    return uptime;
}

/**
 * 장신구 룬에서 강화 스킬명 추출
 * @param {Object} rune - 룬 데이터
 * @returns {string|null} 스킬명 또는 null
 * @added 2025-12-10
 */
function getAccessorySkillName(rune) {
    if (!rune || !rune.description) return null;
    if (rune.category !== '03') return null; // 장신구만

    var text = stripHtml(rune.description);

    // 패턴 1: "스킬명 스킬의 피해량이"
    var pattern1 = /(\S+)\s*스킬의\s*피해량이/;
    var match1 = text.match(pattern1);
    if (match1) return match1[1];

    // 패턴 2: "스킬명 스킬에 변화를 준다"
    var pattern2 = /(\S+)\s*스킬에\s*변화를/;
    var match2 = text.match(pattern2);
    if (match2) return match2[1];

    // 패턴 3: 룬 이름에서 스킬명 추출 (괄호 제외)
    var namePattern = /^(.+?)(?:\(|$)/;
    var nameMatch = rune.name.match(namePattern);

    // 일반적인 스킬 강화 룬 이름 패턴 확인
    if (nameMatch && rune.name.includes('강화') || text.includes('피해량이') && text.includes('증가')) {
        return nameMatch[1].trim();
    }

    return null;
}

/**
 * 추천 시 동일 스킬 룬 중복 체크
 * @param {Array} selectedRunes - 이미 선택된 룬 배열
 * @param {Object} candidateRune - 후보 룬
 * @returns {boolean} 중복 여부
 * @added 2025-12-10
 */
function isDuplicateSkillRune(selectedRunes, candidateRune) {
    var candidateSkill = getAccessorySkillName(candidateRune);

    if (!candidateSkill) return false; // 스킬 강화 룬이 아니면 중복 아님

    for (var i = 0; i < selectedRunes.length; i++) {
        var existingSkill = getAccessorySkillName(selectedRunes[i]);
        if (existingSkill && existingSkill === candidateSkill) {
            return true; // 동일 스킬 발견
        }
    }

    return false;
}

/**
 * 트리거 키워드 패턴
 * @constant {Array}
 */
const TRIGGER_KEYWORDS = [
    '연타 적중 시',
    '강타 적중 시',
    '스킬 사용 시',
    '스킬을 사용할 때',
    '기본 공격 시',
    '기본 공격 적중 시',
    '치명타 적중 시',
    '공격 적중 시',
    '공격 적중시',
    '카운터 공격 적중 시',
    '추가타 적중 시',
    '보조 스킬 사용 시',
    '생존 스킬 사용 시',
    '보조, 생존 스킬 사용 시',
    '궁극기를 사용',
    '전투 중'
];

/**
 * 상태 조건 키워드 패턴
 * @constant {Array}
 */
const STATE_CONDITION_KEYWORDS = [
    '체력이 \\d+% 이상',
    '체력이 \\d+% 미만',
    '보유 자원이 \\d+% 미만',
    '보유 자원이 \\d+% 이상',
    '주변 \\d+m 범위 내에 적이 없을 경우',
    '\\d+초 동안 이동하지 않을 경우',
    '파티 플레이 시',
    '클래스 레벨이 \\d+ 이상'
];

/**
 * 적 상태 조건 키워드 패턴
 * @constant {Array}
 */
const ENEMY_CONDITION_KEYWORDS = [
    '원소 지속 피해를 보유한 적',
    '지속 피해.*?를 보유한 적',
    '지속 피해:.*?을 보유한 적',
    '지속 피해:.*?를 보유한 적'
];

/**
 * 지속 피해 부여 키워드 (시너지용)
 * @constant {Array}
 */
const DOT_KEYWORDS = [
    '지속 피해: 화상',
    '지속 피해: 빙결',
    '지속 피해: 감전',
    '지속 피해: 출혈',
    '지속 피해: 중독',
    '지속 피해: 암흑',
    '지속 피해: 신성',
    '지속 피해: 정신'
];

/**
 * 룬이 지속 피해를 부여하는지 확인
 * @param {Object} rune - 룬 데이터
 * @returns {Array} 부여하는 지속 피해 유형 배열
 */
function getRuneDotTypes(rune) {
    if (!rune || !rune.description) return [];
    const text = stripHtml(rune.description);
    const dotTypes = [];

    DOT_KEYWORDS.forEach(keyword => {
        if (text.includes(keyword.replace('지속 피해: ', ''))) {
            dotTypes.push(keyword);
        }
    });

    return dotTypes;
}

/**
 * 장착된 룬들이 부여하는 모든 지속 피해 유형 수집
 * @returns {Array} 지속 피해 유형 배열
 */
function getAllEquippedDotTypes() {
    const allDots = [];
    Object.values(state.equippedRunes).forEach(rune => {
        if (rune) {
            allDots.push(...getRuneDotTypes(rune));
        }
    });
    return [...new Set(allDots)]; // 중복 제거
}

/**
 * 텍스트에서 효과 유형 감지
 * @param {string} text - 효과 설명 텍스트
 * @returns {string} 효과 유형
 */
function detectEffectType(text) {
    // 누적/축적 효과 체크 (우선순위 높음) @added 2025-12-10
    // 전투 중 쉽게 최대 중첩 유지 가능하므로 높은 가중치 적용
    if (/누적:|축적:|최대\s*\d+\s*회까지\s*중첩/.test(text)) {
        return EFFECT_TYPE.STACKING;
    }

    // 적 상태 조건 체크
    for (const keyword of ENEMY_CONDITION_KEYWORDS) {
        if (new RegExp(keyword, 'i').test(text)) {
            return EFFECT_TYPE.ENEMY_CONDITION;
        }
    }

    // 상태 조건 체크
    for (const keyword of STATE_CONDITION_KEYWORDS) {
        if (new RegExp(keyword, 'i').test(text)) {
            return EFFECT_TYPE.STATE_CONDITION;
        }
    }

    // 트리거 체크
    for (const keyword of TRIGGER_KEYWORDS) {
        if (text.includes(keyword)) {
            return EFFECT_TYPE.TRIGGER;
        }
    }

    // 기본은 상시 효과
    return EFFECT_TYPE.PASSIVE;
}

/**
 * 중첩 정보 파싱
 * @param {string} text - 효과 설명 텍스트
 * @returns {Object|null} { maxStacks, perStack } 또는 null
 */
function parseStackInfo(text) {
    // "최대 N회까지 중첩" 패턴
    const stackPattern = /최대\s*(\d+)\s*회까지\s*중첩/;
    const stackMatch = text.match(stackPattern);

    if (stackMatch) {
        return {
            maxStacks: parseInt(stackMatch[1]),
            hasStack: true
        };
    }

    return null;
}

/**
 * 지속 시간 및 쿨타임 파싱
 * @param {string} text - 효과 설명 텍스트
 * @returns {Object} { duration, cooldown, uptime }
 */
function parseDurationAndCooldown(text) {
    let duration = null;
    let cooldown = null;

    // 지속 시간 패턴: "N초 동안"
    const durationPattern = /(\d+(?:\.\d+)?)\s*초\s*동안/;
    const durationMatch = text.match(durationPattern);
    if (durationMatch) {
        duration = parseFloat(durationMatch[1]);
    }

    // 쿨타임 패턴: "(재사용 대기 시간: N초)"
    const cooldownPattern = /재사용\s*대기\s*시간[:\s]*(?:각\s*)?(\d+(?:\.\d+)?)\s*초/;
    const cooldownMatch = text.match(cooldownPattern);
    if (cooldownMatch) {
        cooldown = parseFloat(cooldownMatch[1]);
    }

    // 업타임 계산
    let uptime = 1.0; // 기본 100%

    if (duration !== null && cooldown !== null) {
        // 지속시간 / (지속시간 + 쿨타임)
        uptime = duration / (duration + cooldown);
    } else if (duration !== null && cooldown === null) {
        // 쿨타임 없으면 트리거 조건만 필요 (80% 가정)
        uptime = 0.8;
    }

    return {
        duration,
        cooldown,
        uptime
    };
}

/**
 * 개별 효과 파싱
 * @param {string} effectText - 개별 효과 문장
 * @param {number} enhanceLevel - 강화 단계
 * @returns {Object|null} 파싱된 효과 객체
 */
function parseSingleEffect(effectText, enhanceLevel = 0) {
    const result = {
        type: detectEffectType(effectText),
        effects: {},
        stackInfo: parseStackInfo(effectText),
        timing: parseDurationAndCooldown(effectText),
        isEnhanceBonus: false,
        enhanceLevel: 0,
        rawText: effectText
    };

    // 강화 효과 체크
    if (/\+10.*강화/.test(effectText)) {
        result.isEnhanceBonus = true;
        result.enhanceLevel = 10;
        if (enhanceLevel < 10) return null; // 강화 조건 미충족
    }
    if (/\+15.*강화/.test(effectText)) {
        result.isEnhanceBonus = true;
        result.enhanceLevel = 15;
        if (enhanceLevel < 15) return null; // 강화 조건 미충족
    }

    // 효과 수치 파싱
    const effectPatterns = [{
            name: '공격력 증가',
            pattern: /공격력이?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:추가로\s*)?증가/
        },
        {
            name: '피해량 증가',
            pattern: /(?:적에게\s*)?주는\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:추가로\s*)?증가/
        },
        {
            name: '무방비 피해 증가',
            pattern: /무방비\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '공격 속도 증가',
            pattern: /공격\s*속도가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '스킬 사용 속도 증가',
            pattern: /스킬\s*사용\s*속도.*?(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '이동 속도 증가',
            pattern: /이동\s*속도.*?(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '캐스팅 속도 증가',
            pattern: /캐스팅.*?속도가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '치명타 확률 증가',
            pattern: /치명타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '치명타 피해 증가',
            pattern: /치명타\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '추가타 확률 증가',
            pattern: /추가타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '받는 피해 감소',
            pattern: /받는\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '받는 피해 증가',
            pattern: /받는\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '회복력 증가',
            pattern: /회복력이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '회복량 증가',
            pattern: /회복량이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '재사용 대기시간 감소',
            pattern: /재사용\s*대기\s*시간이?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '재사용 대기시간 증가',
            pattern: /재사용\s*대기시간이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '스킬 피해량 증가',
            pattern: /스킬.*?피해량이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '기본 공격 피해량 증가',
            pattern: /기본\s*공격.*?피해량이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        }
    ];

    effectPatterns.forEach(({
        name,
        pattern
    }) => {
        const match = effectText.match(pattern);
        if (match) {
            result.effects[name] = parseFloat(match[1]);
        }
    });

    // 효과가 파싱되었으면 반환
    if (Object.keys(result.effects).length > 0) {
        return result;
    }

    return null;
}

/**
 * 룬 설명 전체 파싱 (고급 버전)
 * @param {Object} rune - 룬 데이터
 * @param {number} enhanceLevel - 강화 단계 (0, 10, 15)
 * @returns {Object} 상세 파싱 결과
 * @updated 2025-12-10 - 문장/절 분리 로직 개선 (조건 범위 정확히 적용)
 */
function parseRuneEffectsAdvanced(rune, enhanceLevel) {
    enhanceLevel = enhanceLevel || 0;

    if (!rune || !rune.description) {
        return {
            effects: [],
            totalScore: 0,
            summary: {}
        };
    }

    var text = stripHtml(rune.description);

    // ========================================================
    // 엠블럼 룬의 경우 각성 효과 부분 제외 @added 2025-12-10
    // 각성 효과는 별도로 parseEmblemAwakening에서 처리됨
    // 중복 계산 방지를 위해 일반 파싱에서 제외
    // ========================================================
    if (rune.category === '04') { // 엠블럼
        // 각성 효과 부분 제거: "각성하여 N초 동안 ... (재사용 대기 시간: N초)"
        text = text.replace(/\d+%\s*확률로\s*각성하여\s*\d+초\s*동안.*?(?:재사용\s*대기\s*시간[:\s]*\d+초\)?|(?=\s*상시\s*효과))/g, '');
        // 무방비 각성 제거: "무방비 공격 시 각성하여 N초 동안 ..."
        text = text.replace(/무방비\s*공격\s*시\s*각성하여\s*\d+초\s*동안.*?(?:재사용\s*대기\s*시간[:\s]*\d+초\)?|(?=\s*상시\s*효과))/g, '');
    }

    var parsedEffects = [];

    // ========================================================
    // 시간 감소 효과 사전 체크 (전체 텍스트에서) @added 2025-12-10
    // 문장 분리 전에 감지해야 "전투 시작 시...증가"와 "매 N초마다...감소"가 연결됨
    // ========================================================
    var decayEffect = parseDecayEffect(text);
    if (decayEffect && decayEffect.hasDecay) {
        // 시간 감소 효과를 별도 효과로 추가
        parsedEffects.push({
            type: EFFECT_TYPE.TRIGGER, // 트리거 효과지만 실효값으로 계산됨
            effects: {},
            decayEffects: {
                '공격력 증가 (전투 시작)': {
                    initialValue: decayEffect.initialValue,
                    effectiveValue: decayEffect.effectiveValue,
                    decayInfo: decayEffect
                }
            },
            stackInfo: null,
            timing: {
                uptime: 1.0
            },
            rawText: '전투 시작 시 공격력 ' + decayEffect.initialValue + '% (시간 감소 적용)'
        });

        // 일반 파싱에서 "전투 시작 시" 효과 제거 (중복 방지)
        text = text.replace(/전투\s*시작\s*시[,\s]*공격력이?\s*\d+(?:\.\d+)?\s*%\s*증가.*?감소한다\./g, '');
    }

    // 1단계: 줄바꿈으로 큰 단위 분리
    var lines = text.split(/[\n\r]+/).filter(function(s) {
        return s.trim();
    });

    lines.forEach(function(line) {
        // 2단계: 마침표로 문장 분리 (한국어 문장 종결: 다, 요, 음 뒤의 마침표)
        var sentences = splitIntoSentences(line);

        sentences.forEach(function(sentence) {
            // 3단계: 독립 절로 분리 (하며, 또한, 그리고)
            var clauses = splitIntoClauses(sentence);

            clauses.forEach(function(clause) {
                var parsed = parseSingleEffectImproved(clause.trim(), enhanceLevel);
                if (parsed) {
                    parsedEffects.push(parsed);
                }
            });
        });
    });

    return {
        effects: parsedEffects,
        runeName: rune.name,
        runeId: rune.id,
        dotTypes: getRuneDotTypes(rune)
    };
}

/**
 * 문장 분리 (마침표 기준, 한국어 문장 종결 고려)
 * @param {string} text - 텍스트
 * @returns {Array} 문장 배열
 * @added 2025-12-10
 */
function splitIntoSentences(text) {
    // 마침표 뒤에 공백이 있거나, 문장 종결어미(다, 요, 음, 며) 뒤의 마침표로 분리
    var result = [];
    var current = '';
    var chars = text.split('');

    for (var i = 0; i < chars.length; i++) {
        current += chars[i];

        // 마침표를 만났을 때
        if (chars[i] === '.') {
            // 다음 문자가 공백이거나 끝이면 문장 종료
            if (i === chars.length - 1 || chars[i + 1] === ' ' || chars[i + 1] === '\n') {
                if (current.trim()) {
                    result.push(current.trim());
                }
                current = '';
            }
        }
    }

    // 남은 텍스트 추가
    if (current.trim()) {
        result.push(current.trim());
    }

    return result.length > 0 ? result : [text];
}

/**
 * 독립 절로 분리 (조건과 효과를 분리)
 * @param {string} sentence - 문장
 * @returns {Array} 절 배열
 * @added 2025-12-10
 */
function splitIntoClauses(sentence) {
    var clauses = [];

    // "하며," 또는 "또한," 으로 분리되는 독립적인 효과 확인
    // 패턴: "효과1하며, 효과2" 또는 "효과1. 또한, 효과2"

    // 방법: 트리거 키워드 뒤의 효과만 해당 트리거에 연결
    // "기본 공격 사용 시, 효과1. 효과2하며, 조건 시 효과3"

    // 핵심: 각 효과가 어떤 조건에 종속되는지 정확히 파악

    // 전략 1: "하며," 로 분리 (이 경우 앞 절과 뒷 절이 독립)
    var parts = sentence.split(/하며[,\s]*/);

    if (parts.length > 1) {
        parts.forEach(function(part) {
            if (part.trim()) {
                clauses.push(part.trim());
            }
        });
        return clauses;
    }

    // 전략 2: "또한," 으로 분리
    parts = sentence.split(/또한[,\s]*/);
    if (parts.length > 1) {
        parts.forEach(function(part) {
            if (part.trim()) {
                clauses.push(part.trim());
            }
        });
        return clauses;
    }

    // 분리가 안 되면 원본 반환
    return [sentence];
}

/**
 * 상태 조건 효과 파싱 (체력/자원 조건)
 * @param {string} text - 효과 텍스트
 * @returns {Object|null} 조건 효과 정보
 * @description 체력/자원 조건에 따른 효과 업타임 계산
 * @added 2025-12-10
 */
function parseHealthConditionEffect(text) {
    if (!text) return null;

    // 업타임 기준 (어비스/레이드 기준)
    // 체력 75% 이상 유지: 70% 업타임 (적절한 플레이 기준)
    // 체력 50% 이하 유지: 15% 업타임 (위험 상태, 지양)
    // 자원 50% 미만: 40% 업타임 (자원 관리에 따라 다름)
    // 자원 33% 미만: 25% 업타임 (더 제한적)
    // 적 체력 50% 이하: 50% 업타임 (처형 효과)

    var conditionPatterns = [
        // 내 체력 조건
        {
            pattern: /체력이?\s*(\d+)\s*%\s*이상일?\s*(?:경우|때)/,
            type: 'health_above',
            uptimeCalc: function(threshold) {
                // 체력이 높을수록 유지하기 쉬움
                if (threshold >= 75) return 0.70; // 75% 이상: 70% 업타임
                if (threshold >= 50) return 0.80; // 50% 이상: 80% 업타임
                return 0.90; // 그 이하: 90% 업타임
            }
        },
        {
            pattern: /체력이?\s*(\d+)\s*%\s*이하(?:로\s*감소하면|일?\s*(?:경우|때))/,
            type: 'health_below',
            uptimeCalc: function(threshold) {
                // 체력이 낮을수록 위험 - 유지 어려움
                if (threshold <= 25) return 0.05; // 25% 이하: 5% 업타임 (매우 위험)
                if (threshold <= 50) return 0.15; // 50% 이하: 15% 업타임 (위험)
                return 0.30; // 그 이상: 30% 업타임
            }
        },
        // 자원 조건
        {
            pattern: /(?:보유\s*)?자원이?\s*(\d+)\s*%\s*미만일?\s*(?:경우|때)/,
            type: 'resource_below',
            uptimeCalc: function(threshold) {
                // 자원 관리에 따라 다름
                if (threshold <= 33) return 0.25; // 33% 미만: 25% 업타임
                if (threshold <= 50) return 0.40; // 50% 미만: 40% 업타임
                return 0.50; // 그 이상: 50% 업타임
            }
        },
        // 적 체력 조건
        {
            pattern: /(?:남은\s*)?체력이?\s*(\d+)\s*%\s*이하인?\s*적/,
            type: 'enemy_health_below',
            uptimeCalc: function(threshold) {
                // 처형 효과 - 보스전 기준 후반부에만 유효
                if (threshold <= 25) return 0.25; // 25% 이하: 25% 업타임
                if (threshold <= 50) return 0.50; // 50% 이하: 50% 업타임
                return 0.60;
            }
        }
    ];

    for (var i = 0; i < conditionPatterns.length; i++) {
        var condPattern = conditionPatterns[i];
        var match = text.match(condPattern.pattern);
        if (match) {
            var threshold = parseFloat(match[1]);
            var uptime = condPattern.uptimeCalc(threshold);

            return {
                hasCondition: true,
                type: condPattern.type,
                threshold: threshold,
                uptime: uptime,
                uptimePercent: Math.round(uptime * 100)
            };
        }
    }

    return null;
}

/**
 * 시간 감소 효과 파싱
 * @param {string} text - 효과 텍스트
 * @returns {Object|null} 감소 효과 정보 { hasDecay, initialValue, decayRate, decayInterval, decayDuration, effectiveValue }
 * @description "전투 시작 시 X% 증가, 매 N초마다 Y%씩 감소" 패턴 파싱
 * @added 2025-12-10
 */
function parseDecayEffect(text) {
    if (!text) return null;

    // 패턴: "전투 시작 시, 공격력이 30% 증가한다. 증가한 공격력은 매 3초마다 2%씩 감소한다."
    var combatStartPattern = /전투\s*시작\s*시.*?(\d+(?:\.\d+)?)\s*%\s*증가/;
    var decayPattern = /매\s*(\d+(?:\.\d+)?)\s*초마다\s*(\d+(?:\.\d+)?)\s*%씩?\s*감소/;

    var startMatch = text.match(combatStartPattern);
    var decayMatch = text.match(decayPattern);

    if (!startMatch || !decayMatch) {
        return null;
    }

    var initialValue = parseFloat(startMatch[1]); // 초기값 (예: 30%)
    var decayInterval = parseFloat(decayMatch[1]); // 감소 주기 (예: 3초)
    var decayRate = parseFloat(decayMatch[2]); // 감소량 (예: 2%)

    // 효과 소멸 시간 계산 (초)
    // 30% / 2% = 15회, 15회 × 3초 = 45초
    var decayCount = Math.ceil(initialValue / decayRate);
    var decayDuration = decayCount * decayInterval;

    // 어비스/레이드 기준 전투 시간 (초) - 평균 120초 (2분) 가정
    var combatDuration = 120;

    // 평균 효과값 계산 (선형 감소)
    // 처음: initialValue, 끝: 0, 평균 = initialValue / 2
    var averageValue = initialValue / 2;

    // 업타임 계산
    // 감소 완료 시간이 전투 시간보다 짧으면 일부만 효과
    var effectiveUptime = Math.min(decayDuration, combatDuration) / combatDuration;

    // 실효값 = 평균값 × 업타임
    var effectiveValue = averageValue * effectiveUptime;

    return {
        hasDecay: true,
        initialValue: initialValue,
        decayRate: decayRate,
        decayInterval: decayInterval,
        decayDuration: decayDuration,
        combatDuration: combatDuration,
        effectiveUptime: effectiveUptime,
        averageValue: averageValue,
        effectiveValue: Math.round(effectiveValue * 10) / 10
    };
}

/**
 * 개선된 단일 효과 파싱 (조건 범위 정확히 적용)
 * @param {string} effectText - 효과 텍스트
 * @param {number} enhanceLevel - 강화 단계
 * @returns {Object|null} 파싱된 효과
 * @added 2025-12-10
 */
function parseSingleEffectImproved(effectText, enhanceLevel) {
    if (!effectText || effectText.length < 3) return null;

    var result = {
        type: EFFECT_TYPE.PASSIVE, // 기본은 상시
        effects: {},
        stackInfo: null,
        timing: {
            uptime: 1.0
        },
        isEnhanceBonus: false,
        enhanceLevel: 0,
        rawText: effectText
    };

    // 강화 효과 체크
    if (/\+10.*강화/.test(effectText) || /장비를\s*\+10\s*강화/.test(effectText)) {
        result.isEnhanceBonus = true;
        result.enhanceLevel = 10;
        if (enhanceLevel < 10) return null;
    }
    if (/\+15.*강화/.test(effectText) || /장비를\s*\+15\s*강화/.test(effectText)) {
        result.isEnhanceBonus = true;
        result.enhanceLevel = 15;
        if (enhanceLevel < 15) return null;
    }

    // 조건 키워드와 효과의 위치 관계 분석
    // 핵심: 조건이 효과 바로 앞에 있을 때만 해당 효과에 적용
    var conditionEndIndex = findConditionEndIndex(effectText);

    // 조건 부분과 효과 부분 분리
    var conditionPart = conditionEndIndex > 0 ? effectText.substring(0, conditionEndIndex) : '';
    var effectPart = conditionEndIndex > 0 ? effectText.substring(conditionEndIndex) : effectText;

    // 효과 부분에 직접 조건이 있는지 확인
    var effectConditionIndex = findConditionEndIndex(effectPart);
    if (effectConditionIndex > 0 && effectConditionIndex < effectPart.length - 5) {
        // 효과 부분에도 조건이 있으면 그 조건을 사용
        conditionPart = effectPart.substring(0, effectConditionIndex);
        effectPart = effectPart.substring(effectConditionIndex);
    }

    // ========================================================
    // 누적/축적 효과 먼저 체크 (전체 텍스트에서) @added 2025-12-10
    // "누적:", "축적:", "최대 N회까지 중첩" 패턴은 STACKING 타입
    // ========================================================
    if (/^(누적|축적):/.test(effectText) || /최대\s*\d+\s*회까지\s*중첩/.test(effectText)) {
        result.type = EFFECT_TYPE.STACKING;
    }
    // 조건 부분에서 효과 유형 결정 (STACKING이 아닌 경우만)
    else if (conditionPart) {
        result.type = detectEffectType(conditionPart);
    }
    // 효과 부분에 조건 없이 시작하면 상시 효과
    else if (!hasConditionKeyword(effectPart.substring(0, 20))) {
        result.type = EFFECT_TYPE.PASSIVE;
    }

    // 중첩 정보 파싱
    result.stackInfo = parseStackInfo(effectText);

    // 지속 시간/쿨타임 파싱
    result.timing = parseDurationAndCooldown(effectText);

    // 효과 수치 파싱 (효과 부분에서)
    // @updated 2025-12-10 - 연타/강타/스킬위력 추가
    // @updated 2025-12-10 - 기본 공격 관련 효과 제외 (DPS 비중 낮음)
    // @updated 2025-12-10 - 무방비 공격 적중 시 효과 제외 (브레이크 발동 시간 긺)

    // 기본 공격 관련 효과 체크 (효율에서 제외할 것들)
    var isBasicAttackEffect = /기본\s*공격/.test(effectText);

    // 무방비 공격 적중 시 효과 체크 (효율에서 제외) @added 2025-12-10
    // 브레이크 발동까지 시간이 오래 걸려 실제 DPS 기여도 낮음
    var isDefenseBreakEffect = /무방비\s*공격\s*적중\s*시/.test(effectText);

    // ========================================================
    // 제한적 효과 체크 (효율에서 제외) @added 2025-12-10
    // 특정 조건/스킬에서만 발동되어 범용성이 낮은 효과들
    // ========================================================

    // 브레이크/무방비 피해 관련 (브레이크 발동 어려움)
    var isBreakDamageEffect = /브레이크\s*(?:스킬.*)?피해|무방비\s*피해/.test(effectText);

    // 특정 스킬 피해량 (범용성 낮음)
    // 예: "드래곤 헌터 스킬의 피해량이", "보조, 생존 스킬의 피해량이"
    var isSpecificSkillDamage = /\S+\s*스킬의\s*피해량/.test(effectText) && !/스킬\s*피해량/.test(effectText);

    // 특정 지속 피해 보유 조건 (시너지 필요)
    // 예: "지속 피해: 중독을 보유한 적에게"
    var isDotConditionEffect = /지속\s*피해:\s*\S+을?\s*보유한\s*적/.test(effectText);

    // 특정 상태/범위 조건 (상황 의존)
    // 예: "주변 3m 범위 내에 적이 없을 경우"
    var isRangeConditionEffect = /범위\s*내에?\s*적이?\s*없을/.test(effectText);

    // 궁극기/각성 사용 시 효과 (직업군/시너지 의존) @added 2025-12-10
    // 궁극기 충전 속도가 직업마다 다르고 시너지 룬에 따라 크게 달라짐
    var isUltimateConditionEffect = /궁극기\s*사용\s*시|각성\s*(?:혹은\s*)?궁극기\s*사용\s*시/.test(effectText);

    // 통합 제한적 효과 체크
    var isLimitedEffect = isBreakDamageEffect || isSpecificSkillDamage || isDotConditionEffect || isRangeConditionEffect || isUltimateConditionEffect;

    // ========================================================
    // 시간 감소 효과 체크 @added 2025-12-10
    // "전투 시작 시 X% 증가, 매 N초마다 Y%씩 감소" 패턴
    // 어비스/레이드 기준 전투 시간이 길어서 효과가 빠르게 소멸
    // ========================================================
    var decayEffectInfo = parseDecayEffect(effectText);
    var hasDecayEffect = decayEffectInfo && decayEffectInfo.hasDecay;

    // ========================================================
    // 상태 조건 효과 체크 @added 2025-12-10
    // 체력/자원 조건에 따른 효과 - 업타임 제한적
    // ========================================================
    var healthConditionInfo = parseHealthConditionEffect(effectText);

    var effectPatterns = [{
            name: '공격력 증가',
            pattern: /공격력이?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:추가로\s*)?증가/
        },
        {
            name: '피해량 증가',
            pattern: /(?:적에게\s*)?주는\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:추가로\s*)?증가/,
            // 기본 공격 피해량은 별도 효과로 처리
            excludeIfBasicAttack: true
        },
        {
            name: '치명타 확률 증가',
            pattern: /치명타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '치명타 피해 증가',
            pattern: /치명타\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '연타 확률 증가',
            pattern: /연타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '강타 확률 증가',
            pattern: /강타\s*(?:확률이?|피해가?)\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '추가타 확률 증가',
            // "기본 공격 추가타"가 아닌 일반 추가타만 매칭
            pattern: /(?<!기본\s*공격\s*)(?<!기본\s*공격의?\s*)추가타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/,
            // 기본 공격 추가타는 별도 효과로 처리
            excludeIfBasicAttack: true
        },
        {
            name: '스킬 위력 증가',
            pattern: /스킬\s*(?:위력|피해)이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '공격 속도 증가',
            pattern: /공격\s*속도가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/,
            // 기본 공격 속도는 별도 효과로 처리
            excludeIfBasicAttack: true
        },
        {
            name: '받는 피해 감소',
            pattern: /받는\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '회복력 증가',
            pattern: /회복력이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        }
    ];

    // 기본 공격 관련 효과 패턴 (기타 효과로 분류) @added 2025-12-10
    var basicAttackPatterns = [{
            name: '기본 공격 추가타 확률 증가',
            pattern: /기본\s*공격(?:의)?\s*추가타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '기본 공격 피해량 증가',
            pattern: /기본\s*공격(?:의)?\s*피해량이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '기본 공격 속도 증가',
            pattern: /기본\s*공격\s*속도가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        }
    ];

    // 무방비 공격 적중 시 효과 패턴 (기타 효과로 분류) @added 2025-12-10
    // 브레이크 발동까지 시간이 오래 걸려 어비스/레이드에서 효율 낮음
    var defenseBreakPatterns = [{
            name: '무방비 피해량 증가',
            pattern: /(?:무방비\s*공격\s*적중\s*시.*?)?주는\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '무방비 공격 속도 증가',
            pattern: /(?:무방비\s*공격\s*적중\s*시.*?)?공격\s*속도가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '무방비 스킬 속도 증가',
            pattern: /(?:무방비\s*공격\s*적중\s*시.*?)?스킬\s*사용\s*속도.*?(\d+(?:\.\d+)?)\s*%?\s*증가/
        }
    ];

    // 제한적 효과 패턴 (기타 효과로 분류) @added 2025-12-10
    // 브레이크/무방비/특정스킬 등 범용성 낮은 효과들
    var limitedEffectPatterns = [{
            name: '브레이크 스킬 피해 증가',
            pattern: /브레이크\s*스킬.*?피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '브레이크 피해 증가',
            pattern: /브레이크\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '무방비 피해 증가',
            pattern: /무방비\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '특정 스킬 피해량 증가',
            pattern: /(\S+)\s*스킬의\s*피해량이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '지속 피해 조건 피해 증가',
            pattern: /지속\s*피해.*?보유한\s*적.*?피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '거리 조건 피해 증가',
            pattern: /범위\s*내에?\s*적이?\s*없을.*?피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        // 궁극기/각성 사용 시 효과 @added 2025-12-10
        {
            name: '궁극기 사용 시 공격력 증가',
            pattern: /궁극기\s*사용\s*시.*?공격력이?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        },
        {
            name: '궁극기 사용 시 피해량 증가',
            pattern: /궁극기\s*사용\s*시.*?피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*증가/
        }
    ];

    /**
     * 결함(디메리트) 효과 패턴
     * @description DPS에 영향을 주는 감소 효과
     * @added 2025-12-10
     */
    var demeritPatterns = [{
            name: '피해량 감소',
            // "적에게 주는 피해가 X% 감소" 또는 "주는 모든 피해가 X% 감소"
            pattern: /(?:적에게\s*)?주는\s*(?:모든\s*)?피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '멀티히트 피해 감소',
            // "멀티히트 피해가 X% 감소" 또는 "멀티히트 피해는 X% 감소"
            pattern: /멀티히트\s*피해(?:가|는)?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '치명타 확률 감소',
            pattern: /치명타\s*확률이?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '치명타 피해 감소',
            pattern: /치명타\s*피해가?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '공격력 감소',
            pattern: /공격력이?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        // @added 2025-12-10 - 추가 결함 효과
        {
            name: '쿨타임 회복 속도 감소',
            // "재사용 대기 시간 회복 속도가 X% 감소" - 스킬 DPS에 영향
            pattern: /재사용\s*대기\s*시간\s*회복\s*속도가?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '스킬 사용 속도 감소',
            // "스킬 사용 속도가 X% 감소" 또는 "스킬 사용 속도와 캐스팅 및 차지 속도가 X% 감소"
            pattern: /스킬\s*사용\s*속도(?:가|와)?\s*(?:.*?)?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        },
        {
            name: '캐스팅 속도 감소',
            // "캐스팅 및 차지 속도가 X% 감소"
            pattern: /캐스팅\s*(?:및\s*)?(?:차지\s*)?속도가?\s*(\d+(?:\.\d+)?)\s*%?\s*감소/
        }
    ];

    // 결함 영역 여부 확인 ("결함:" 이후의 텍스트인지)
    var isDemeritSection = /결함\s*[:：]/.test(effectText);

    // 기본 공격 관련 효과 먼저 파싱 @added 2025-12-10
    // 기본 공격 효과는 별도 필드에 저장 (DPS 효율에서 제외)
    if (isBasicAttackEffect) {
        basicAttackPatterns.forEach(function(item) {
            var match = effectText.match(item.pattern);
            if (match) {
                if (!result.basicAttackEffects) {
                    result.basicAttackEffects = {};
                }
                result.basicAttackEffects[item.name] = parseFloat(match[1]);
            }
        });
    }

    // 무방비 공격 적중 시 효과 파싱 @added 2025-12-10
    // 브레이크 발동까지 시간이 오래 걸려 DPS 효율에서 제외
    if (isDefenseBreakEffect) {
        defenseBreakPatterns.forEach(function(item) {
            var match = effectText.match(item.pattern);
            if (match) {
                if (!result.defenseBreakEffects) {
                    result.defenseBreakEffects = {};
                }
                result.defenseBreakEffects[item.name] = parseFloat(match[1]);
            }
        });
        // 무방비 효과는 일반 효과에서 제외하고 리턴
        result.isDefenseBreakOnly = true;
    }

    // 제한적 효과 파싱 @added 2025-12-10
    // 브레이크/무방비/특정스킬 등 범용성 낮은 효과들
    if (isLimitedEffect) {
        limitedEffectPatterns.forEach(function(item) {
            var match = effectText.match(item.pattern);
            if (match) {
                if (!result.limitedEffects) {
                    result.limitedEffects = {};
                }
                // 특정 스킬의 경우 스킬명도 저장
                if (item.name === '특정 스킬 피해량 증가' && match[1] && match[2]) {
                    var skillName = match[1];
                    result.limitedEffects[skillName + ' 스킬 피해량 증가'] = parseFloat(match[2]);
                } else {
                    result.limitedEffects[item.name] = parseFloat(match[1]);
                }
            }
        });
        result.isLimitedEffect = true;
    }

    // 전체 텍스트에서 효과 파싱 (수치 추출)
    // @updated 2025-12-10 - 기본 공격 관련 효과 제외 처리
    // @updated 2025-12-10 - 무방비 공격 적중 시 효과 제외 처리
    // @updated 2025-12-10 - 제한적 효과 제외 처리
    effectPatterns.forEach(function(item) {
        // 기본 공격 관련 효과면서 제외 플래그가 있으면 스킵
        if (item.excludeIfBasicAttack && isBasicAttackEffect) {
            return; // 스킵
        }

        // 무방비 공격 적중 시 효과면 핵심 DPS 효과에서 제외
        if (isDefenseBreakEffect) {
            return; // 스킵 - 무방비 효과는 별도 처리됨
        }

        // 제한적 효과면 핵심 DPS 효과에서 제외 @added 2025-12-10
        // 브레이크/무방비/특정스킬 등 범용성 낮은 효과
        if (isLimitedEffect && (item.name === '피해량 증가' || item.name === '공격력 증가')) {
            return; // 스킵 - 제한적 효과는 별도 처리됨
        }

        var match = effectText.match(item.pattern);
        if (match) {
            var effectValue = parseFloat(match[1]);

            // 시간 감소 효과 적용 @added 2025-12-10
            // "전투 시작 시 X% 증가, 매 N초마다 Y%씩 감소" 패턴인 경우
            if (hasDecayEffect && item.name === '공격력 증가') {
                // 전투 시작 시 효과는 별도 처리
                if (!result.decayEffects) {
                    result.decayEffects = {};
                }
                result.decayEffects[item.name + ' (전투 시작)'] = {
                    initialValue: decayEffectInfo.initialValue,
                    effectiveValue: decayEffectInfo.effectiveValue,
                    decayInfo: decayEffectInfo
                };
                // 상시 효과만 일반 효과에 저장 (전투 시작 효과 제외)
                // 예: "공격력이 8% 증가한다" 부분
                var permanentMatch = effectText.match(/공격력이?\s*(\d+(?:\.\d+)?)\s*%\s*증가.*?전투\s*시작/);
                if (permanentMatch) {
                    effectValue = parseFloat(permanentMatch[1]);
                } else {
                    // 상시 효과 없이 전투 시작 효과만 있으면 스킵
                    return;
                }
            }

            // 상태 조건 효과 처리 @added 2025-12-10
            // 체력/자원 조건이 있으면 업타임 적용한 실효값으로 저장
            if (healthConditionInfo && healthConditionInfo.hasCondition) {
                if (!result.conditionEffects) {
                    result.conditionEffects = {};
                }

                // 조건 타입에 따른 라벨
                var conditionLabel = '';
                switch (healthConditionInfo.type) {
                    case 'health_above':
                        conditionLabel = '체력 ' + healthConditionInfo.threshold + '% 이상';
                        break;
                    case 'health_below':
                        conditionLabel = '체력 ' + healthConditionInfo.threshold + '% 이하';
                        break;
                    case 'resource_below':
                        conditionLabel = '자원 ' + healthConditionInfo.threshold + '% 미만';
                        break;
                    case 'enemy_health_below':
                        conditionLabel = '적 체력 ' + healthConditionInfo.threshold + '% 이하';
                        break;
                    default:
                        conditionLabel = '조건부';
                }

                var effectiveValue = effectValue * healthConditionInfo.uptime;
                result.conditionEffects[item.name + ' (' + conditionLabel + ')'] = {
                    rawValue: effectValue,
                    effectiveValue: Math.round(effectiveValue * 10) / 10,
                    conditionInfo: healthConditionInfo
                };
                // 조건부 효과는 일반 효과에서 제외
                return;
            }

            result.effects[item.name] = effectValue;
        }
    });

    // 결함(디메리트) 효과 파싱 - 음수로 저장하거나 별도 필드에 저장
    // @added 2025-12-10
    demeritPatterns.forEach(function(item) {
        var match = effectText.match(item.pattern);
        if (match) {
            var value = parseFloat(match[1]);
            // 결함 효과는 별도로 저장 (나중에 점수에서 차감)
            if (!result.demerits) {
                result.demerits = {};
            }
            result.demerits[item.name] = value;

            // 결함 영역이거나 감소 효과가 명시된 경우 표시
            result.hasDemerit = true;
        }
    });

    // 효과 또는 결함 또는 특수 효과가 있으면 반환 @updated 2025-12-10
    var hasEffects = Object.keys(result.effects).length > 0;
    var hasDemerits = result.demerits && Object.keys(result.demerits).length > 0;
    var hasBasicAttackEffects = result.basicAttackEffects && Object.keys(result.basicAttackEffects).length > 0;
    var hasDefenseBreakEffects = result.defenseBreakEffects && Object.keys(result.defenseBreakEffects).length > 0;
    var hasLimitedEffects = result.limitedEffects && Object.keys(result.limitedEffects).length > 0;
    var hasDecayEffects = result.decayEffects && Object.keys(result.decayEffects).length > 0;
    var hasConditionEffects = result.conditionEffects && Object.keys(result.conditionEffects).length > 0;

    if (hasEffects || hasDemerits || hasBasicAttackEffects || hasDefenseBreakEffects || hasLimitedEffects || hasDecayEffects || hasConditionEffects) {
        return result;
    }

    return null;
}

/**
 * 조건 키워드의 끝 위치 찾기
 * @param {string} text - 텍스트
 * @returns {number} 조건 끝 인덱스 (없으면 0)
 * @added 2025-12-10
 */
function findConditionEndIndex(text) {
    // 조건 패턴: "~시," 또는 "~경우,"
    var conditionPatterns = [
        /(?:적중|사용|공격)\s*시[,\s]/,
        /경우[,\s]/,
        /때[,\s]/,
        /중[,\s]/
    ];

    var endIndex = 0;

    conditionPatterns.forEach(function(pattern) {
        var match = text.match(pattern);
        if (match) {
            var matchEnd = match.index + match[0].length;
            if (matchEnd > endIndex) {
                endIndex = matchEnd;
            }
        }
    });

    return endIndex;
}

/**
 * 조건 키워드 존재 여부 확인
 * @param {string} text - 텍스트
 * @returns {boolean}
 * @added 2025-12-10
 */
function hasConditionKeyword(text) {
    var keywords = ['시,', '시 ', '경우', '때마다', '중 '];
    for (var i = 0; i < keywords.length; i++) {
        if (text.includes(keywords[i])) return true;
    }
    return false;
}

/**
 * 효과의 실효 값 계산 (가중치, 업타임, 스택 적용)
 * @param {Object} parsedEffect - 파싱된 개별 효과
 * @param {boolean} hasSynergy - 시너지 충족 여부 (적 상태 조건용)
 * @returns {Object} 실효 효과 값
 */
function calculateEffectiveValue(parsedEffect, hasSynergy = false) {
    const result = {};

    // 기본 가중치
    let typeWeight = EFFECT_TYPE_WEIGHT[parsedEffect.type] || 1.0;

    // 적 상태 조건 + 시너지 보너스
    if (parsedEffect.type === EFFECT_TYPE.ENEMY_CONDITION && hasSynergy) {
        typeWeight = 0.9; // 50% -> 90%로 상승
    }

    // 업타임 비율
    const uptime = (parsedEffect.timing && parsedEffect.timing.uptime) || 1.0;

    // 스택 배율
    const stackMultiplier = (parsedEffect.stackInfo && parsedEffect.stackInfo.maxStacks) || 1;

    // 각 효과에 가중치 적용
    Object.entries(parsedEffect.effects).forEach(([effectName, value]) => {
        // 실효값 = 기본값 × 스택 × 가중치 × 업타임
        const effectiveValue = value * stackMultiplier * typeWeight * uptime;

        result[effectName] = {
            raw: value,
            stacks: stackMultiplier,
            typeWeight: typeWeight,
            uptime: uptime,
            effective: effectiveValue,
            type: parsedEffect.type
        };
    });

    return result;
}

/**
 * DPS 핵심 효과 목록
 * @constant {Array}
 * @description 효율 점수 계산에 포함되는 핵심 DPS 효과
 * @updated 2025-12-10 - 연타/강타/추가타 추가, 스탯 효율 반영
 */
/**
 * DPS 핵심 효과 목록
 * @updated 2025-12-10 - 엠블럼 각성 효과 전체 검수 반영
 */
const CORE_DPS_EFFECTS = [
    '공격력 증가',
    '피해량 증가',
    '스킬 피해 증가', // @added 2025-12-10
    '치명타 확률 증가',
    '치명타 피해 증가',
    '연타 확률 증가',
    '연타 피해 증가', // @added 2025-12-10
    '강타 확률 증가',
    '강타 피해 증가', // @added 2025-12-10
    '추가타 확률 증가'
];

/**
 * DPS 관련 결함 효과 목록
 * @constant {Array<string>}
 * @description 효율 점수에서 차감되는 결함 효과
 * @added 2025-12-10
 */
const CORE_DPS_DEMERITS = [
    '피해량 감소', // 적에게 주는 피해 감소
    '멀티히트 피해 감소', // 멀티히트 피해 감소
    '치명타 확률 감소', // 치명타 확률 감소
    '치명타 피해 감소', // 치명타 피해 감소
    '공격력 감소', // 공격력 감소
    // @added 2025-12-10 - 추가 결함 효과
    '쿨타임 회복 속도 감소', // 재사용 대기 시간 회복 속도 감소 (스킬 DPS 감소)
    '스킬 사용 속도 감소', // 스킬 시전 속도 감소 (DPS 감소)
    '캐스팅 속도 감소' // 캐스팅/차지 속도 감소 (DPS 감소)
];

/**
 * 결함 효과 → 대응 증가 효과 매핑
 * @constant {Object}
 * @description 결함 효과를 해당 증가 효과의 음수로 변환할 때 사용
 * @added 2025-12-10
 */
const DEMERIT_TO_BENEFIT_MAP = {
    '피해량 감소': '피해량 증가',
    '멀티히트 피해 감소': '멀티히트 피해 감소', // 별도 관리
    '치명타 확률 감소': '치명타 확률 증가',
    '치명타 피해 감소': '치명타 피해 증가',
    '공격력 감소': '공격력 증가'
};

/**
 * 효과별 점수 가중치 (효율 순위 반영)
 * @constant {Object}
 * @description 연타 > 추가타 > 치명타 > 스킬 위력 순
 * @added 2025-12-10
 * @updated 2025-12-10 - 결함 효과 가중치 추가
 */
/**
 * 효과별 점수 가중치
 * @updated 2025-12-10 - 엠블럼 각성 효과 전체 검수 반영
 */
const EFFECT_SCORE_WEIGHT = {
    '공격력 증가': 10,
    '피해량 증가': 10,
    '스킬 피해 증가': 10, // 피해량 증가와 동급 @added 2025-12-10
    '연타 확률 증가': 12, // 효율 1위
    '연타 피해 증가': 9, // 연타 피해 (확률보다 낮은 가중치) @added 2025-12-10
    '강타 확률 증가': 11,
    '강타 피해 증가': 9, // 강타 피해 (확률보다 낮은 가중치) @added 2025-12-10
    '추가타 확률 증가': 11, // 효율 2위
    '치명타 확률 증가': 9, // 효율 3위
    '치명타 피해 증가': 9,
    '스킬 위력 증가': 7, // 효율 4위 (기타 효과)
    // 결함 효과 가중치 (감소분이므로 음수로 적용됨)
    '피해량 감소': 10,
    '멀티히트 피해 감소': 10, // 멀티히트 비중 40~50% 반영 @updated 2025-12-10
    '치명타 확률 감소': 9,
    '치명타 피해 감소': 9,
    '공격력 감소': 10,
    // @updated 2025-12-10 - 결함 효과 가중치 상향
    // 쿨타임 회복 속도 감소 = 스킬 사용 빈도 감소 = DPS 직접 감소
    // 7% 감소 → DPS 7% 감소이므로 공격력 증가와 동등한 가중치
    '쿨타임 회복 속도 감소': 10, // 공격력 증가와 동등 (DPS 직접 영향)
    '스킬 사용 속도 감소': 8, // 시전 속도 감소 (DPS 약 8% 영향)
    '캐스팅 속도 감소': 7 // 캐스팅/차지 속도 (마법사 계열 DPS 영향)
};

/**
 * 스탯 → 퍼센트 환산 비율
 * @constant {Object}
 * @description 마비노기 모바일 스탯 환산 공식
 * @added 2025-12-10
 */
const STAT_TO_PERCENT = {
    '치명타': 100, // 100당 1%
    '연타': 85, // 85당 1%
    '강타': 85, // 85당 1%
    '스킬위력': 85, // 85당 1%
    '추가타': 130 // 130당 1%
};

/**
 * 시너지 룬 목록 (특정 룬 착용 시 효율 변화)
 * @constant {Object}
 * @added 2025-12-10
 */
const SYNERGY_RUNES = {
    '현란': {
        boost: {
            '치명타 확률 증가': 1.5,
            '치명타 피해 증가': 1.5
        },
        description: '치명타 효율 50% 상승'
    },
    '아득': {
        boost: {
            '치명타 확률 증가': 1.3,
            '치명타 피해 증가': 1.3
        },
        description: '치명타 효율 30% 상승'
    },
    '각성': {
        boost: {
            '치명타 확률 증가': 1.3,
            '치명타 피해 증가': 1.3
        },
        description: '치명타 효율 30% 상승'
    },
    '압도': {
        boost: {
            '치명타 확률 증가': 1.2,
            '치명타 피해 증가': 1.2
        },
        description: '치명타 효율 20% 상승'
    }
};

/**
 * 한계효용 감소 계산 (Diminishing Returns)
 * @param {number} currentValue - 현재 누적 효과 값 (%)
 * @param {number} addValue - 추가될 효과 값 (%)
 * @returns {number} 실제 기대 효용 값 (%)
 * @description 합연산 효과는 현재 총합이 높을수록 추가 효용이 감소
 * @added 2025-12-10
 */
function calculateDiminishingReturn(currentValue, addValue) {
    // 공식: 추가효용 = addValue / (1 + currentValue/100)
    // 예: 현재 100% 공격력 증가 상태에서 10% 추가 시
    //     실제 기대 효용 = 10 / (1 + 100/100) = 10 / 2 = 5%
    var multiplier = 1 + (currentValue / 100);
    return addValue / multiplier;
}

/**
 * 예상 DPS 증가율 계산
 * @param {Object} effectSummary - 효과 요약 객체
 * @param {Object} characterStats - 캐릭터 스탯 (선택)
 * @param {Object} demeritSummary - 결함 효과 요약 (선택) @added 2025-12-10
 * @returns {Object} { totalDPSIncrease, breakdown }
 * @description 최종 DPS = 기본공격력 × (1+공격력증가) × (1+피해량증가) × 크리배율 × 연타배율 × 추가타배율
 * @added 2025-12-10
 * @updated 2025-12-10 - 결함 효과 반영 추가
 */
function calculateExpectedDPS(effectSummary, characterStats, demeritSummary) {
    characterStats = characterStats || {};
    demeritSummary = demeritSummary || {};

    // 효과 추출 (기본값 0)
    var atkIncrease = 0;
    var dmgIncrease = 0;
    var critChance = 0;
    var critDmg = 0;
    var multiHit = 0;
    var strongHit = 0;
    var additionalHit = 0;

    // 결함 효과 (차감용) @added 2025-12-10
    var dmgDecrease = 0;
    var multiHitDecrease = 0;
    var critChanceDecrease = 0;
    var critDmgDecrease = 0;
    var atkDecrease = 0;
    // @added 2025-12-10 - 추가 결함 효과
    var cooldownRecoveryDecrease = 0; // 쿨타임 회복 속도 감소
    var skillSpeedDecrease = 0; // 스킬 사용 속도 감소
    var castingSpeedDecrease = 0; // 캐스팅/차지 속도 감소

    Object.entries(effectSummary).forEach(function([name, data]) {
        var value = data.total || 0;
        if (name.includes('공격력 증가')) atkIncrease += value;
        if (name.includes('피해량 증가')) dmgIncrease += value;
        if (name.includes('치명타 확률') && name.includes('증가')) critChance += value;
        if (name.includes('치명타 피해') && name.includes('증가')) critDmg += value;
        if (name.includes('연타 확률')) multiHit += value;
        if (name.includes('강타')) strongHit += value;
        if (name.includes('추가타 확률')) additionalHit += value;
    });

    // 결함 효과 추출 @added 2025-12-10
    Object.entries(demeritSummary).forEach(function([name, data]) {
        var value = data.total || 0;
        if (name.includes('피해량 감소')) dmgDecrease += value;
        if (name.includes('멀티히트 피해 감소')) multiHitDecrease += value;
        if (name.includes('치명타 확률 감소')) critChanceDecrease += value;
        if (name.includes('치명타 피해 감소')) critDmgDecrease += value;
        if (name.includes('공격력 감소')) atkDecrease += value;
        // @added 2025-12-10 - 추가 결함 효과 추출
        if (name.includes('쿨타임 회복 속도 감소')) cooldownRecoveryDecrease += value;
        if (name.includes('스킬 사용 속도 감소')) skillSpeedDecrease += value;
        if (name.includes('캐스팅 속도 감소')) castingSpeedDecrease += value;
    });

    // 결함 효과 차감 적용 @added 2025-12-10
    atkIncrease -= atkDecrease;
    dmgIncrease -= dmgDecrease;
    critChance -= critChanceDecrease;
    critDmg -= critDmgDecrease;

    // 캐릭터 기본 스탯 반영 (있는 경우)
    var baseCritChance = characterStats.critChance || 30; // 기본 30%
    var baseCritDmg = characterStats.critDmg || 150; // 기본 150%
    var baseMultiHit = characterStats.multiHit || 10; // 기본 10%
    var baseAdditionalHit = characterStats.additionalHit || 5; // 기본 5%

    // 각 배율 계산
    var atkMultiplier = 1 + (atkIncrease / 100);
    var dmgMultiplier = 1 + (dmgIncrease / 100);

    // 크리티컬 기대값: (1 - 크리확률) × 1 + 크리확률 × (크리피해/100)
    var totalCritChance = Math.min((baseCritChance + critChance) / 100, 1); // 최대 100%
    var totalCritDmg = (baseCritDmg + critDmg) / 100;
    var critMultiplier = (1 - totalCritChance) + (totalCritChance * totalCritDmg);

    // 연타/추가타 기대값
    var totalMultiHit = (baseMultiHit + multiHit + strongHit) / 100;
    var totalAdditionalHit = (baseAdditionalHit + additionalHit) / 100;
    var hitMultiplier = 1 + totalMultiHit + totalAdditionalHit;

    // 멀티히트 피해 감소 반영 @added 2025-12-10
    // 멀티히트 피해 감소는 연타/추가타 피해에만 영향
    var multiHitPenalty = 1 - (multiHitDecrease / 100);
    var effectiveMultiHitBonus = (totalMultiHit + totalAdditionalHit) * multiHitPenalty;
    hitMultiplier = 1 + effectiveMultiHitBonus;

    // 쿨타임/스킬 속도 감소 배율 계산 @added 2025-12-10
    // 쿨타임 회복 속도 감소 = 스킬 사용 빈도 감소 = DPS 감소
    // 예: 9% 감소 → 스킬 사용 주기가 약 9% 늘어남 → DPS 약 9% 감소
    var totalSpeedDecrease = cooldownRecoveryDecrease + (skillSpeedDecrease * 0.7) + (castingSpeedDecrease * 0.5);
    var speedPenaltyMultiplier = 1 - (totalSpeedDecrease / 100);

    // 최종 DPS 배율
    var totalDPSMultiplier = atkMultiplier * dmgMultiplier * critMultiplier * hitMultiplier * speedPenaltyMultiplier;
    var totalDPSIncrease = (totalDPSMultiplier - 1) * 100;

    return {
        totalDPSIncrease: Math.round(totalDPSIncrease * 10) / 10,
        breakdown: {
            attackMultiplier: Math.round(atkMultiplier * 1000) / 1000,
            damageMultiplier: Math.round(dmgMultiplier * 1000) / 1000,
            critMultiplier: Math.round(critMultiplier * 1000) / 1000,
            hitMultiplier: Math.round(hitMultiplier * 1000) / 1000,
            speedMultiplier: Math.round(speedPenaltyMultiplier * 1000) / 1000, // @added 2025-12-10
            rawValues: {
                atkIncrease: Math.round(atkIncrease * 10) / 10,
                dmgIncrease: Math.round(dmgIncrease * 10) / 10,
                critChance: Math.round(critChance * 10) / 10,
                critDmg: Math.round(critDmg * 10) / 10,
                multiHit: Math.round(multiHit * 10) / 10,
                strongHit: Math.round(strongHit * 10) / 10,
                additionalHit: Math.round(additionalHit * 10) / 10,
                // 결함 효과 표시 @added 2025-12-10
                multiHitDecrease: Math.round(multiHitDecrease * 10) / 10,
                atkDecrease: Math.round(atkDecrease * 10) / 10,
                dmgDecrease: Math.round(dmgDecrease * 10) / 10,
                critChanceDecrease: Math.round(critChanceDecrease * 10) / 10,
                // @added 2025-12-10 - 추가 결함 효과
                cooldownDecrease: Math.round(cooldownRecoveryDecrease * 10) / 10,
                skillSpeedDecrease: Math.round(skillSpeedDecrease * 10) / 10,
                castingSpeedDecrease: Math.round(castingSpeedDecrease * 10) / 10
            }
        },
        balance: {
            atkToDmgRatio: dmgIncrease > 0 ? Math.round((atkIncrease / dmgIncrease) * 100) / 100 : 'N/A',
            isBalanced: Math.abs(atkIncrease - dmgIncrease) < 20, // 20% 이내면 균형
            recommendation: atkIncrease > dmgIncrease + 20 ?
                '피해량 증가 룬 추천' : (dmgIncrease > atkIncrease + 20 ? '공격력 증가 룬 추천' : '균형 잡힌 세팅')
        },
        // 결함 영향 표시 @added 2025-12-10
        hasDemeritImpact: (dmgDecrease + multiHitDecrease + critChanceDecrease + critDmgDecrease + atkDecrease + cooldownRecoveryDecrease + skillSpeedDecrease + castingSpeedDecrease) > 0
    };
}

/**
 * 시너지 룬 효과 체크
 * @param {Array} equippedRunes - 장착된 룬 목록
 * @returns {Object} { synergies, totalBoost }
 * @added 2025-12-10
 */
function checkSynergyRunes(equippedRunes) {
    var synergies = [];
    var totalBoost = {};

    if (!equippedRunes || !Array.isArray(equippedRunes)) {
        equippedRunes = Object.values(state.equippedRunes);
    }

    equippedRunes.forEach(function(rune) {
        if (!rune || !rune.name) return;

        Object.entries(SYNERGY_RUNES).forEach(function([synName, synData]) {
            if (rune.name.includes(synName)) {
                synergies.push({
                    runeName: rune.name,
                    synergyName: synName,
                    description: synData.description,
                    boost: synData.boost
                });

                // 부스트 누적
                Object.entries(synData.boost).forEach(function([effectName, multiplier]) {
                    if (!totalBoost[effectName]) {
                        totalBoost[effectName] = 1;
                    }
                    totalBoost[effectName] *= multiplier;
                });
            }
        });
    });

    return {
        synergies: synergies,
        totalBoost: totalBoost,
        hasSynergy: synergies.length > 0
    };
}

/**
 * 룬의 총 효율 점수 계산 (새로운 방식)
 * @param {Object} rune - 룬 데이터
 * @param {number} enhanceLevel - 강화 단계
 * @param {Array} equippedDotTypes - 장착된 룬들의 지속 피해 유형
 * @param {number} awakeningCooldownReduction - 각성 쿨타임 감소량 (초)
 * @param {Object} options - 추가 옵션 { currentEffects, characterStats, synergyBoost }
 * @returns {Object} { score, breakdown, effectiveSummary, dpsAnalysis }
 * @updated 2025-12-10 - DPS 핵심 효과만 점수 계산에 포함
 * @updated 2025-12-10 - 엠블럼 각성 효과 및 시너지 추가
 * @updated 2025-12-10 - 한계효용 감소, 시너지 룬, DPS 분석 추가
 */
function calculateRuneEfficiencyScore(rune, enhanceLevel, equippedDotTypes, awakeningCooldownReduction, options) {
    // 기본값 설정
    enhanceLevel = enhanceLevel || 0;
    equippedDotTypes = equippedDotTypes || [];
    awakeningCooldownReduction = awakeningCooldownReduction || 0;
    options = options || {};

    // 옵션에서 추가 정보 추출
    var currentEffects = options.currentEffects || {}; // 현재 누적 효과 (한계효용 계산용)
    var characterStats = options.characterStats || {}; // 캐릭터 스탯
    var synergyBoost = options.synergyBoost || {}; // 시너지 룬 부스트

    const parsed = parseRuneEffectsAdvanced(rune, enhanceLevel);

    // 시너지 체크 (적 상태 조건용)
    const hasSynergy = equippedDotTypes.length > 0;

    let totalScore = 0;
    const breakdown = [];
    const effectiveSummary = {};

    parsed.effects.forEach(function(effect) {
        const effective = calculateEffectiveValue(effect, hasSynergy);

        Object.entries(effective).forEach(function([effectName, data]) {
            // DPS 핵심 효과만 점수 계산에 포함
            if (!CORE_DPS_EFFECTS.includes(effectName)) {
                // 효과 요약에는 포함하지만 점수에는 반영하지 않음
                if (!effectiveSummary[effectName]) {
                    effectiveSummary[effectName] = {
                        total: 0,
                        details: [],
                        isCoreDPS: false
                    };
                }
                effectiveSummary[effectName].total += data.effective;
                effectiveSummary[effectName].details.push(data);
                return; // 점수 계산 스킵
            }

            // DPS 핵심 효과별 점수 가중치 (새로운 가중치 테이블 사용)
            var scoreWeight = EFFECT_SCORE_WEIGHT[effectName] || 10;

            // 시너지 룬 부스트 적용
            if (synergyBoost[effectName]) {
                scoreWeight *= synergyBoost[effectName];
            }

            // 한계효용 감소 적용 (공격력/피해량 증가에만)
            var effectiveValue = data.effective;
            if ((effectName === '공격력 증가' || effectName === '피해량 증가') && currentEffects[effectName]) {
                var diminishedValue = calculateDiminishingReturn(currentEffects[effectName], data.effective);
                effectiveValue = diminishedValue;
            }

            var effectScore = effectiveValue * scoreWeight;
            totalScore += effectScore;

            // 요약에 추가 (DPS 핵심 효과로 표시)
            if (!effectiveSummary[effectName]) {
                effectiveSummary[effectName] = {
                    total: 0,
                    details: [],
                    isCoreDPS: true, // DPS 핵심 효과 표시
                    diminished: false // 한계효용 감소 적용 여부
                };
            }
            effectiveSummary[effectName].total += data.effective;
            effectiveSummary[effectName].details.push(data);

            // 한계효용 감소가 적용되었는지 표시
            if (effectiveValue !== data.effective) {
                effectiveSummary[effectName].diminished = true;
                effectiveSummary[effectName].diminishedValue = effectiveValue;
            }

            breakdown.push({
                effectName: effectName,
                raw: data.raw,
                stacks: data.stacks,
                typeWeight: data.typeWeight,
                uptime: data.uptime,
                effective: data.effective,
                diminishedEffective: effectiveValue,
                type: data.type,
                scoreWeight: scoreWeight,
                contribution: effectScore,
                hasSynergyBoost: !!synergyBoost[effectName]
            });
        });

        // ====================================================
        // 결함(디메리트) 효과 처리 - 점수에서 차감
        // @added 2025-12-10
        // ====================================================
        if (effect.demerits && Object.keys(effect.demerits).length > 0) {
            Object.entries(effect.demerits).forEach(function([demeritName, value]) {
                // DPS 관련 결함인 경우에만 점수에서 차감
                if (CORE_DPS_DEMERITS.includes(demeritName)) {
                    var demeritWeight = EFFECT_SCORE_WEIGHT[demeritName] || 8;
                    var demeritScore = value * demeritWeight;

                    // 점수에서 차감
                    totalScore -= demeritScore;

                    // 결함 요약에 추가
                    var demeritDisplayName = demeritName + ' (결함)';
                    if (!effectiveSummary[demeritDisplayName]) {
                        effectiveSummary[demeritDisplayName] = {
                            total: 0,
                            details: [],
                            isCoreDPS: true,
                            isDemerit: true // 결함 표시
                        };
                    }
                    effectiveSummary[demeritDisplayName].total += value;
                    effectiveSummary[demeritDisplayName].details.push({
                        raw: value,
                        effective: -value,
                        type: '결함'
                    });

                    breakdown.push({
                        effectName: demeritDisplayName,
                        raw: value,
                        effective: -value,
                        type: '결함',
                        scoreWeight: demeritWeight,
                        contribution: -demeritScore,
                        isDemerit: true
                    });
                }
            });
        }

        // ====================================================
        // 기본 공격 효과 처리 - 기타 효과로 분류 (점수 미반영)
        // @added 2025-12-10
        // ====================================================
        if (effect.basicAttackEffects && Object.keys(effect.basicAttackEffects).length > 0) {
            Object.entries(effect.basicAttackEffects).forEach(function([effectName, value]) {
                // 기본 공격 효과는 기타 효과로 표시 (점수 미반영)
                var displayName = effectName + ' (기본공격)';
                if (!effectiveSummary[displayName]) {
                    effectiveSummary[displayName] = {
                        total: 0,
                        details: [],
                        isCoreDPS: false,
                        isBasicAttack: true // 기본 공격 효과 표시
                    };
                }
                effectiveSummary[displayName].total += value;
                effectiveSummary[displayName].details.push({
                    raw: value,
                    effective: value,
                    type: '기본 공격'
                });
            });
        }

        // ====================================================
        // 무방비 공격 적중 시 효과 처리 - 기타 효과로 분류 (점수 미반영)
        // @added 2025-12-10
        // 브레이크 발동까지 시간이 오래 걸려 어비스/레이드에서 효율 낮음
        // ====================================================
        if (effect.defenseBreakEffects && Object.keys(effect.defenseBreakEffects).length > 0) {
            Object.entries(effect.defenseBreakEffects).forEach(function([effectName, value]) {
                // 무방비 효과는 기타 효과로 표시 (점수 미반영)
                var displayName = effectName + ' (무방비)';
                if (!effectiveSummary[displayName]) {
                    effectiveSummary[displayName] = {
                        total: 0,
                        details: [],
                        isCoreDPS: false,
                        isDefenseBreak: true // 무방비 효과 표시
                    };
                }
                effectiveSummary[displayName].total += value;
                effectiveSummary[displayName].details.push({
                    raw: value,
                    effective: value,
                    type: '무방비'
                });
            });
        }

        // ====================================================
        // 제한적 효과 처리 - 기타 효과로 분류 (점수 미반영)
        // @added 2025-12-10
        // 브레이크/무방비/특정스킬 등 범용성 낮은 효과들
        // ====================================================
        if (effect.limitedEffects && Object.keys(effect.limitedEffects).length > 0) {
            Object.entries(effect.limitedEffects).forEach(function([effectName, value]) {
                // 제한적 효과는 기타 효과로 표시 (점수 미반영)
                var displayName = effectName + ' (제한적)';
                if (!effectiveSummary[displayName]) {
                    effectiveSummary[displayName] = {
                        total: 0,
                        details: [],
                        isCoreDPS: false,
                        isLimitedEffect: true // 제한적 효과 표시
                    };
                }
                effectiveSummary[displayName].total += value;
                effectiveSummary[displayName].details.push({
                    raw: value,
                    effective: value,
                    type: '제한적'
                });
            });
        }

        // ====================================================
        // 시간 감소 효과 처리 - 실효값 적용하여 점수 계산
        // @added 2025-12-10
        // "전투 시작 시 X% 증가, 매 N초마다 Y%씩 감소" 패턴
        // 어비스/레이드 기준 전투 시간이 길어서 실효값으로 계산
        // ====================================================
        if (effect.decayEffects && Object.keys(effect.decayEffects).length > 0) {
            Object.entries(effect.decayEffects).forEach(function([effectName, data]) {
                var initialValue = data.initialValue;
                var effectiveValue = data.effectiveValue;
                var decayInfo = data.decayInfo;

                // 실효값으로 점수 계산
                var scoreWeight = EFFECT_SCORE_WEIGHT['공격력 증가'] || 10;
                var effectScore = effectiveValue * scoreWeight;
                totalScore += effectScore;

                // 시간 감소 효과로 표시
                var displayName = effectName;
                if (!effectiveSummary[displayName]) {
                    effectiveSummary[displayName] = {
                        total: 0,
                        details: [],
                        isCoreDPS: true, // DPS 효과지만 감소 적용
                        isDecayEffect: true,
                        decayInfo: decayInfo
                    };
                }
                effectiveSummary[displayName].total += effectiveValue;
                effectiveSummary[displayName].details.push({
                    raw: initialValue,
                    effective: effectiveValue,
                    type: '시간 감소',
                    decayDuration: decayInfo.decayDuration,
                    effectiveUptime: Math.round(decayInfo.effectiveUptime * 100)
                });

                breakdown.push({
                    effectName: displayName,
                    raw: initialValue,
                    effective: effectiveValue,
                    type: '시간 감소',
                    scoreWeight: scoreWeight,
                    contribution: effectScore,
                    decayInfo: '초기 ' + initialValue + '% → ' + decayInfo.decayDuration + '초 후 소멸'
                });
            });
        }

        // ====================================================
        // 상태 조건 효과 처리 - 업타임 적용하여 점수 계산
        // @added 2025-12-10
        // 체력/자원 조건에 따른 효과는 업타임이 제한적
        // ====================================================
        if (effect.conditionEffects && Object.keys(effect.conditionEffects).length > 0) {
            Object.entries(effect.conditionEffects).forEach(function([effectName, data]) {
                var rawValue = data.rawValue;
                var effectiveValue = data.effectiveValue;
                var conditionInfo = data.conditionInfo;

                // 효과 타입 추출 (공격력 증가, 피해량 증가 등)
                var baseEffectName = effectName.replace(/\s*\([^)]+\)\s*$/, '');

                // 핵심 DPS 효과인 경우만 점수에 반영
                var isCoreDPS = CORE_DPS_EFFECTS.indexOf(baseEffectName) !== -1;
                if (isCoreDPS) {
                    var scoreWeight = EFFECT_SCORE_WEIGHT[baseEffectName] || 10;
                    var effectScore = effectiveValue * scoreWeight;
                    totalScore += effectScore;
                }

                // 조건 효과로 표시
                var displayName = effectName;
                if (!effectiveSummary[displayName]) {
                    effectiveSummary[displayName] = {
                        total: 0,
                        details: [],
                        isCoreDPS: isCoreDPS,
                        isConditionEffect: true,
                        conditionInfo: conditionInfo
                    };
                }
                effectiveSummary[displayName].total += effectiveValue;
                effectiveSummary[displayName].details.push({
                    raw: rawValue,
                    effective: effectiveValue,
                    type: '상태 조건',
                    conditionType: conditionInfo.type,
                    uptime: conditionInfo.uptimePercent
                });

                breakdown.push({
                    effectName: displayName,
                    raw: rawValue,
                    effective: effectiveValue,
                    type: '상태 조건',
                    scoreWeight: isCoreDPS ? (EFFECT_SCORE_WEIGHT[baseEffectName] || 10) : 0,
                    contribution: isCoreDPS ? (effectiveValue * (EFFECT_SCORE_WEIGHT[baseEffectName] || 10)) : 0,
                    conditionInfo: '업타임 ' + conditionInfo.uptimePercent + '%'
                });
            });
        }
    });

    // 엠블럼 각성 효과 추가 계산 (엠블럼 룬인 경우)
    // @added 2025-12-10
    var awakeningInfo = null;
    if (rune.category === '04') { // 엠블럼
        var awakening = parseEmblemAwakening(rune.description);

        if (awakening && awakening.hasAwakening) {
            // 무방비 각성은 제한적 효과로 처리
            if (awakening.isDefenseBreakAwakening) {
                awakeningInfo = {
                    duration: awakening.duration,
                    baseCooldown: awakening.cooldown,
                    isLimited: true,
                    limitReason: '무방비 발동 필요'
                };
                // 기본 공격 각성도 제한적 효과로 처리 @added 2025-12-10
            } else if (awakening.isBasicAttackAwakening) {
                awakeningInfo = {
                    duration: awakening.duration,
                    baseCooldown: awakening.cooldown,
                    isLimited: true,
                    limitReason: '기본 공격 효과 (DPS 비중 낮음)'
                };
            } else {
                var effectiveCooldown = Math.max(awakening.cooldown - awakeningCooldownReduction, 10);
                // 업타임 = 지속시간 / (지속시간 + 쿨타임)
                // 발동 확률은 업타임에 미포함 (쿨타임 후 거의 즉시 발동)
                var uptime = awakening.duration / (awakening.duration + effectiveCooldown);

                awakeningInfo = {
                    duration: awakening.duration,
                    baseCooldown: awakening.cooldown,
                    reducedCooldown: effectiveCooldown,
                    uptime: uptime
                };

                // 각성 효과를 업타임 적용하여 점수에 반영
                Object.entries(awakening.awakeningEffects).forEach(function([effectName, value]) {
                    if (CORE_DPS_EFFECTS.includes(effectName)) {
                        var effectiveValue = value * uptime;
                        // 효과별 가중치 사용 @updated 2025-12-10
                        var scoreWeight = EFFECT_SCORE_WEIGHT[effectName] || 10;

                        var effectScore = effectiveValue * scoreWeight;
                        totalScore += effectScore;

                        // 요약에 추가 (각성 효과로 표시)
                        var awakeningEffectName = effectName + ' (각성)';
                        if (!effectiveSummary[awakeningEffectName]) {
                            effectiveSummary[awakeningEffectName] = {
                                total: 0,
                                details: [],
                                isCoreDPS: true,
                                isAwakening: true
                            };
                        }
                        effectiveSummary[awakeningEffectName].total += effectiveValue;

                        breakdown.push({
                            effectName: awakeningEffectName,
                            raw: value,
                            uptime: uptime,
                            effective: effectiveValue,
                            type: 'awakening',
                            scoreWeight: scoreWeight,
                            contribution: effectScore
                        });
                    }
                });

                // 상시 효과 추가
                Object.entries(awakening.passiveEffects).forEach(function([effectName, value]) {
                    if (CORE_DPS_EFFECTS.includes(effectName)) {
                        // 효과별 가중치 사용 @updated 2025-12-10
                        var scoreWeight = EFFECT_SCORE_WEIGHT[effectName] || 10;

                        var effectScore = value * scoreWeight;
                        totalScore += effectScore;

                        if (!effectiveSummary[effectName]) {
                            effectiveSummary[effectName] = {
                                total: 0,
                                details: [],
                                isCoreDPS: true
                            };
                        }
                        effectiveSummary[effectName].total += value;
                    }
                });
            } // else 블록 종료
        }
    }

    // DPS 분석 추가 (2025-12-10)
    var dpsAnalysis = calculateExpectedDPS(effectiveSummary, characterStats);

    return {
        score: Math.round(totalScore * 10) / 10,
        breakdown: breakdown,
        effectiveSummary: effectiveSummary,
        dotTypes: parsed.dotTypes,
        coreDPSEffects: CORE_DPS_EFFECTS,
        awakeningInfo: awakeningInfo, // 각성 정보 추가
        dpsAnalysis: dpsAnalysis, // DPS 분석 추가
        synergyApplied: Object.keys(synergyBoost).length > 0 // 시너지 적용 여부
    };
}

/**
 * 기존 호환성을 위한 래퍼 함수
 * @param {string} description - 룬 설명
 * @param {number} enhanceLevel - 강화 단계
 * @returns {Object} 단순화된 효과 객체
 */
function parseRuneEffects(description, enhanceLevel = 0) {
    // 임시 룬 객체 생성
    const tempRune = {
        description,
        name: '',
        id: 0
    };
    const result = calculateRuneEfficiencyScore(tempRune, enhanceLevel, getAllEquippedDotTypes());

    // 기존 형식으로 변환
    const simpleEffects = {};
    Object.entries(result.effectiveSummary).forEach(([name, data]) => {
        simpleEffects[name] = Math.round(data.total * 10) / 10;
    });

    return simpleEffects;
}


    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * EffectParser 전역 객체
     * @global
     */
    window.EffectParser = {
        // 상수
        EFFECT_TYPE: EFFECT_TYPE,
        EFFECT_TYPE_WEIGHT: EFFECT_TYPE_WEIGHT,
        EMBLEM_AWAKENING_BASE_COOLDOWN: EMBLEM_AWAKENING_BASE_COOLDOWN,

        // 엠블럼 파싱
        parseEmblemAwakening: parseEmblemAwakening,
        calculateAwakeningUptime: calculateAwakeningUptime,
        parseAwakeningCooldownReduction: parseAwakeningCooldownReduction,

        // 효과 파싱
        parseEffectValues: parseEffectValues,
        parseRuneEffect: typeof parseRuneEffectsAdvanced !== 'undefined' ? parseRuneEffectsAdvanced : null,
        parseRuneEffectsAdvanced: typeof parseRuneEffectsAdvanced !== 'undefined' ? parseRuneEffectsAdvanced : null,
        parseEnhanceEffect: typeof parseEnhanceEffect !== 'undefined' ? parseEnhanceEffect : null,
        parseDecayEffect: typeof parseDecayEffect !== 'undefined' ? parseDecayEffect : null,

        // 장신구/시너지
        getAccessorySkillName: getAccessorySkillName,
        isDuplicateSkillRune: isDuplicateSkillRune,
        checkSynergyRunes: typeof checkSynergyRunes !== 'undefined' ? checkSynergyRunes : null,

        // 도트 효과
        parseDotEffect: typeof parseDotEffect !== 'undefined' ? parseDotEffect : null,
        getAllEquippedDotTypes: typeof getAllEquippedDotTypes !== 'undefined' ? getAllEquippedDotTypes : null,

        // 효율 계산
        calculateRuneEfficiencyScore: typeof calculateRuneEfficiencyScore !== 'undefined' ? calculateRuneEfficiencyScore : null,
        calculateEfficiencyForSlot: typeof calculateEfficiencyForSlot !== 'undefined' ? calculateEfficiencyForSlot : null
    };

    console.log('✅ EffectParser 모듈 로드 완료');

})();
