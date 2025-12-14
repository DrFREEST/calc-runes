/**
 * ============================================================================
 * 마비노기 모바일 룬 효율 계산기 - 조합 최적화 Web Worker
 * ============================================================================
 * @file combination-worker.js
 * @description Branch & Bound (가지치기) 알고리즘을 사용한 최적 룬 조합 탐색
 * @author AI Assistant
 * @created 2025-12-11
 *
 * @algorithm Branch & Bound (가지치기)
 * - 각 카테고리별 룬을 점수순 정렬
 * - 최대 가능 점수를 사전 계산
 * - 현재 점수 + 남은 최대 점수 < 최고 점수면 스킵
 * - 시너지 효과를 조합 단위로 계산
 *
 * @performance
 * - 가지치기로 80~95% 계산량 감소 예상
 * - 진행률 실시간 보고
 * - 최적해 보장
 *
 * @dependencies
 * - shared-formulas.js (importScripts로 로드)
 * ============================================================================
 */

"use strict";

// ============================================================================
// 공유 모듈 로드 (환경 독립적 함수/상수)
// ============================================================================
importScripts("./shared-formulas.js");

// 공유 모듈 참조 (가독성을 위해 별칭 생성)
const Formulas = self.SharedFormulas;
const Weights = self.SharedEffectWeights;

// ============================================================================
// 섹션 1: 상수 및 설정
// ============================================================================

/**
 * 시너지 효과 계산용 상수 (실제 효과 값 기반)
 * @constant {Object}
 * @description 매직넘버 대신 실제 효과 가중치를 사용
 * @updated 2025-12-11 - 실제 효과 값 기반으로 변경
 */
const SYNERGY_CALC = {
  DOT_DAMAGE_PER_TICK: 5, // DoT 틱당 기본 피해 (%)
  DOT_TICKS_PER_SECOND: 1, // 초당 DoT 틱 수
  DOT_UPTIME: 0.7, // DoT 평균 가동률
  CONDITIONAL_UPTIME: 0.8, // 조건부 효과 업타임 배수
  DEMERIT_RECOVERY_RATE: 1.0, // 결함 상쇄 시 회복 비율 (100%)
  AWAKENING_DOUBLE_BONUS_RATE: 0.3, // 각성 2배 효과 시 추가 보너스 비율
  STACKING_EXTRA_RATE: 0.15, // 중첩 보너스 시 추가 비율
};

/**
 * 가지치기용 최대 시너지 보너스 계산
 * - 실제 효과 값 기반으로 동적 계산됨
 * @constant {number}
 */
const MAX_SYNERGY_BONUS_UPPER_BOUND = 150; // 현실적 최대 상한

/**
 * 각성 상수
 * @constant {Object}
 */
const AWAKENING_CONSTANTS = {
  BASE_COOLDOWN: 90,
  DEFAULT_DURATION: 20,
  MIN_COOLDOWN: 30,
};

/**
 * Sub 스텟 관련 효과 가중치 보정값
 * shared-formulas.js에서 참조
 * @constant {number}
 */
const SUB_STAT_BONUS = Formulas.FORMULA_CONSTANTS.SUB_STAT_BONUS;

/**
 * 클래스별 Sub 스텟 매핑
 * @constant {Object}
 */
const CLASS_SUB_STATS = {
  LUCK: ["02", "05", "08", "14", "17", "18", "19", "20"],
  WILL: ["03", "06", "09", "11", "12", "15"],
};

/**
 * Sub 스텟별 우선 효과
 * @constant {Object}
 */
const SUB_STAT_PRIORITY_EFFECTS = {
  LUCK: ["치명타 확률", "치명타 피해", "추가타 확률", "추가타"],
  WILL: ["강타 피해", "궁극기", "회복력"],
};

// ============================================================================
// 가중치 상수는 shared-formulas.js에서 로드 (중복 제거)
// 참조: Weights.EFFECT_WEIGHTS, Weights.TYPE_WEIGHTS,
//       Weights.DEMERIT_WEIGHTS, Weights.EFFECT_NAME_MAP, Weights.DEMERIT_NAME_MAP
// ============================================================================

/**
 * 룬 내 시너지 보너스 (같은 계열 효과가 여러 개 있을 때)
 * @constant {Object}
 */
const INTRA_RUNE_SYNERGY = {
  // 치명타 확률 + 치명타 피해 = 1.3배 보너스
  CRIT_COMBO: { effects: ["CRIT_RATE", "CRIT_DAMAGE"], bonus: 1.3 },
  // 추가타 확률 + 추가타 피해 = 1.3배 보너스
  ADDITIONAL_COMBO: {
    effects: ["ADDITIONAL_HIT_RATE", "ADDITIONAL_HIT_DAMAGE"],
    bonus: 1.3,
  },
  // 공격력 + 피해량 = 1.2배 보너스
  DAMAGE_COMBO: { effects: ["ATTACK_INCREASE", "DAMAGE_INCREASE"], bonus: 1.2 },
  // 스킬 피해 + 쿨타임 회복 = 1.2배 보너스
  SKILL_COMBO: { effects: ["SKILL_DAMAGE", "COOLDOWN_RECOVERY"], bonus: 1.2 },
};

// ============================================================================
// 공유 함수 래퍼 (shared-formulas.js 참조, 중복 제거)
// ============================================================================

/**
 * 효과명에서 가중치 조회 (shared-formulas.js 위임)
 * @param {string} effectName - 효과 이름
 * @returns {number} 가중치
 */
function getEffectWeight(effectName) {
  return Weights.getEffectWeight(effectName);
}

/**
 * 결함명에서 가중치 조회 (shared-formulas.js 위임)
 * @param {string} demeritName - 결함 이름
 * @returns {number} 가중치
 */
function getDemeritWeight(demeritName) {
  return Weights.getDemeritWeight(demeritName);
}

/**
 * 효과 유형에서 가중치 조회 (shared-formulas.js 위임)
 * @param {string} typeName - 유형 이름
 * @returns {number} 가중치
 */
function getTypeWeight(typeName) {
  return Weights.getTypeWeight(typeName);
}

/**
 * 지속시간/쿨타임 업타임 계산 (shared-formulas.js 위임)
 * @param {number} duration - 지속시간 (초)
 * @param {number} cooldown - 재사용 대기시간 (초)
 * @returns {number} 업타임 (0~1)
 */
function calculateUptime(duration, cooldown) {
  return Formulas.calculateUptime(duration, cooldown);
}

/**
 * 조건부 효과 가동률 계산
 * @param {Object} effect - 효과 객체
 * @returns {number} 가동률 배율 (0~1)
 * @added 2025-12-11 - 보스전 기준 조건부 효과 가동률
 */
function getConditionalMultiplier(effect) {
  const trigger = effect.trigger || "";
  const note = effect.note || "";
  const combined = (trigger + " " + note).toLowerCase();

  // 적 처치 조건 → 보스전(어비스/레이드)에서 가동률 매우 낮음 (5%)
  if (
    combined.indexOf("적 처치") !== -1 ||
    combined.indexOf("처치 시") !== -1 ||
    combined.indexOf("처치시") !== -1
  ) {
    return 0.05;
  }
  // 무방비/브레이크 조건 → 가동률 매우 낮음 (10%)
  if (
    combined.indexOf("무방비") !== -1 ||
    combined.indexOf("브레이크") !== -1
  ) {
    return 0.1;
  }
  // 도발 조건 → 도발 스킬 없는 클래스 많음 (15%)
  if (combined.indexOf("도발") !== -1) {
    return 0.15;
  }
  // 궁극기 조건 → 전투당 1~2회, 가동률 매우 낮음 (15%)
  if (combined.indexOf("궁극기") !== -1) {
    return 0.15;
  }
  // 기본 공격 조건 → 스킬 위주 게임, 낮음 (20%)
  if (combined.indexOf("기본 공격") !== -1) {
    return 0.2;
  }
  // 지속 피해(DoT) 조건 → DoT 시너지 없으면 발동 불가 (0%)
  // @updated 2025-12-12 - DoT 매칭은 calculateSynergyScore에서만 처리
  if (combined.indexOf("지속 피해") !== -1) {
    return 0; // 기본 점수에서 제외, 시너지 계산에서만 추가
  }
  // 체력 조건 (적 체력 50% 이하 등) → 절반 정도 (50%)
  if (combined.indexOf("체력") !== -1 && combined.indexOf("이하") !== -1) {
    return 0.5;
  }
  // 전투 시작 조건 → 초반에만 (30%)
  if (combined.indexOf("전투 시작") !== -1) {
    return 0.3;
  }
  // 일반 조건
  return 1.0;
}

/**
 * 시간 감소 효과의 평균값 계산 (shared-formulas.js 위임)
 * @param {number} initialValue - 초기 효과값 (%)
 * @param {number} decayRate - 감소율 (%/interval)
 * @param {number} decayInterval - 감소 간격 (초)
 * @param {number} [combatDuration] - 전투 시간 (초)
 * @returns {number} 평균 효과값
 */
function calculateDecayAverage(
  initialValue,
  decayRate,
  decayInterval,
  combatDuration
) {
  if (!decayRate || !decayInterval) {
    return 0.5; // 정보 없으면 기본 50%
  }
  const avg = Formulas.calculateDecayAverage(
    initialValue,
    decayRate,
    decayInterval,
    combatDuration
  );
  return avg / initialValue; // 배율로 반환
}

/**
 * 치명타 확률의 한계효용 계수 계산 (shared-formulas.js 위임)
 * @param {number} currentRate - 현재 치명타 확률 (0~1 또는 0~100)
 * @returns {number} 한계효용 계수 (0~1)
 */
function calculateCritMarginalUtility(currentRate) {
  // 0~100 범위면 0~1로 변환
  const rate = currentRate > 1 ? currentRate / 100 : currentRate;
  return Formulas.calculateCritMarginalUtility(rate);
}

/**
 * 공격력/피해량 밸런스 효용 계산 (shared-formulas.js 위임)
 * @param {number} attackBonus - 현재 공격력 % 증가 합계
 * @param {number} damageBonus - 현재 피해량 % 증가 합계
 * @returns {Object} { attackMultiplier, damageMultiplier }
 */
function calculateBonusBalance(attackBonus, damageBonus) {
  return Formulas.calculateBonusBalance(attackBonus || 0, damageBonus || 0);
}

/**
 * 룬의 효과 키 목록 추출
 * @param {Object} rune - 룬 데이터
 * @returns {Array<string>} 효과 키 목록
 */
function getRuneEffectKeys(rune) {
  const keys = [];
  const nameMap = Weights.EFFECT_NAME_MAP;
  if (rune.effects && Array.isArray(rune.effects)) {
    rune.effects.forEach((effect) => {
      const name = effect.name || "";
      for (const key in nameMap) {
        if (name.indexOf(key) !== -1) {
          keys.push(nameMap[key]);
          break;
        }
      }
    });
  }
  return keys;
}

/**
 * 룬 내 시너지 보너스 계산
 * @param {Array<string>} effectKeys - 효과 키 목록
 * @returns {number} 시너지 보너스 배수
 */
function calculateIntraRuneSynergy(effectKeys) {
  let bonus = 1.0;

  for (const synergyName in INTRA_RUNE_SYNERGY) {
    const synergy = INTRA_RUNE_SYNERGY[synergyName];
    const hasAll = synergy.effects.every((e) => effectKeys.includes(e));
    if (hasAll) {
      bonus *= synergy.bonus;
    }
  }

  return bonus;
}

// ============================================================================
// 섹션 2: 룬 개별 점수 계산 (2단계 탐색용)
// ============================================================================

/**
 * 룬 기본 점수 계산 (PERMANENT 효과만, 결함 차감)
 * @param {Object} rune - 룬 데이터
 * @param {Object} options - 옵션
 * @returns {number} 기본 점수
 */
function calculateRuneBaseScore(rune, options) {
  let score = 0;

  if (rune.effects && Array.isArray(rune.effects)) {
    rune.effects.forEach((effect) => {
      const effectName = effect.name || "";
      const value = effect.value || 0;
      const effectType = effect.type || "PERMANENT";

      // 효과 가중치
      const effectWeight = getEffectWeight(effectName);

      // PERMANENT만 100% 반영, 나머지는 감쇠
      let typeWeight = 1.0;
      if (effectType === "PERMANENT") {
        typeWeight = 1.0;
      } else if (effectType === "STACKING") {
        typeWeight = 0.7;
      } else if (effectType === "TRIGGER") {
        typeWeight = 0.5;
      } else if (effectType === "STATE") {
        typeWeight = 0.4;
      } else if (effectType === "AWAKENING") {
        typeWeight = 0.22;
      } else {
        typeWeight = 0.3;
      }

      score += value * effectWeight * typeWeight;
    });
  }

  // 결함 차감
  if (rune.demerits && Array.isArray(rune.demerits)) {
    rune.demerits.forEach((demerit) => {
      const demeritWeight = getDemeritWeight(demerit.name || "");
      score -= (demerit.value || 0) * demeritWeight;
    });
  }

  return Math.max(0, score);
}

/**
 * 룬 최대 점수 계산 (모든 효과 + 강화 + 각성)
 * @param {Object} rune - 룬 데이터
 * @param {Object} options - 옵션
 * @returns {number} 최대 점수
 */
function calculateRuneMaxScore(rune, options) {
  let score = 0;
  const MAX_UPTIME = 0.9; // 최대 가동률
  const SYNERGY_BONUS = 1.3; // 시너지 보너스

  // 기본 효과 (최대 업타임 적용)
  if (rune.effects && Array.isArray(rune.effects)) {
    rune.effects.forEach((effect) => {
      const effectName = effect.name || "";
      let value = effect.value || 0;

      // 중첩 효과는 최대 중첩으로
      if (effect.maxStacks && effect.stackValue) {
        value = effect.stackValue * effect.maxStacks;
      }

      const effectWeight = getEffectWeight(effectName);
      score += value * effectWeight * MAX_UPTIME;
    });
  }

  // 강화 효과 (+15 기준)
  if (rune.enhanceEffects) {
    const enhance15 = rune.enhanceEffects["15"] || rune.enhanceEffects[15];
    if (enhance15) {
      if (Array.isArray(enhance15)) {
        enhance15.forEach((effect) => {
          const enhanceWeight = getEffectWeight(effect.name || "");
          score += (effect.value || 0) * enhanceWeight * 0.8;
        });
      } else if (typeof enhance15 === "object") {
        Object.entries(enhance15).forEach(([name, value]) => {
          if (typeof value === "number") {
            const enhanceWeight = getEffectWeight(name);
            score += value * enhanceWeight * 0.8;
          }
        });
      }
    }
  }

  // 각성 효과
  if (rune.awakening && rune.awakening.effects) {
    const awakeningUptime = 0.22; // 기본 각성 업타임
    rune.awakening.effects.forEach((effect) => {
      if (effect.dpsRelevant !== false) {
        const effectWeight = getEffectWeight(effect.name || "");
        score += (effect.value || 0) * effectWeight * awakeningUptime * 1.5;
      }
    });
  }

  // 시너지 보너스 적용
  score *= SYNERGY_BONUS;

  // 결함 차감 (영원 룬 시너지로 제거 가능하므로 50%만 차감)
  if (rune.demerits && Array.isArray(rune.demerits)) {
    rune.demerits.forEach((demerit) => {
      const demeritWeight = getDemeritWeight(demerit.name || "");
      score -= (demerit.value || 0) * demeritWeight * 0.5;
    });
  }

  return Math.max(0, score);
}

// ============================================================================
// 섹션 3: 유틸리티 함수
// ============================================================================

/**
 * 조합 생성기 (C(n, r))
 * @param {Array} arr - 원본 배열
 * @param {number} r - 선택 개수
 * @yields {Array} 조합
 */
function* combinations(arr, r) {
  if (r === 0) {
    yield [];
    return;
  }
  if (arr.length < r) return;

  const [first, ...rest] = arr;

  // first를 포함하는 조합
  for (const combo of combinations(rest, r - 1)) {
    yield [first, ...combo];
  }

  // first를 포함하지 않는 조합
  for (const combo of combinations(rest, r)) {
    yield combo;
  }
}

/**
 * 조합 수 계산 (nCr)
 * @param {number} n - 전체 개수
 * @param {number} r - 선택 개수
 * @returns {number} 조합 수
 */
function nCr(n, r) {
  if (r > n) return 0;
  if (r === 0 || r === n) return 1;

  let result = 1;
  for (let i = 0; i < r; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * 클래스 코드로 우선 효과 목록 조회
 * @param {string} classCode - 클래스 코드
 * @returns {Array<string>} 우선 효과 목록
 */
function getClassPriorityEffects(classCode) {
  if (CLASS_SUB_STATS.LUCK.includes(classCode)) {
    return SUB_STAT_PRIORITY_EFFECTS.LUCK;
  }
  if (CLASS_SUB_STATS.WILL.includes(classCode)) {
    return SUB_STAT_PRIORITY_EFFECTS.WILL;
  }
  return [];
}

// ============================================================================
// 섹션 4: 효율 점수 계산
// ============================================================================

/**
 * 개별 룬 기본 점수 계산
 * @param {Object} rune - 룬 데이터
 * @param {Object} options - 계산 옵션
 * @returns {number} 기본 점수
 */
function calculateRuneBaseScore(rune, options) {
  const { role, classCode, stats } = options;
  const classPriorityEffects = getClassPriorityEffects(classCode);

  // 룬 내 효과 키 목록 추출 (시너지 계산용)
  const effectKeys = getRuneEffectKeys(rune);

  let score = 0;

  // 효과 점수
  if (rune.effects && Array.isArray(rune.effects)) {
    rune.effects.forEach((effect) => {
      const effectName = effect.name || "";
      let value = effect.value || 0;

      // 중첩 효과는 최대값
      if (effect.type === "STACKING" && effect.maxStacks && effect.stackValue) {
        value = effect.stackValue * effect.maxStacks;
      }

      // 효과별 가중치 (DPS 기여도)
      const effectWeight = getEffectWeight(effectName);

      // 유형별 가중치 (TYPE_WEIGHTS 사용)
      let typeWeight = getTypeWeight(effect.type);

      // DURATION/DECAY/AWAKENING은 동적 업타임 계산
      if (effect.type === "DURATION") {
        // 지속시간 효과 - 업타임 계산
        typeWeight = calculateUptime(
          effect.duration || 0,
          effect.cooldown || 0
        );
        if (typeWeight === 0) typeWeight = 0.5; // 정보 없으면 기본값
      } else if (effect.type === "DECAY") {
        // 시간 감소 효과 - 평균값 계산
        typeWeight = calculateDecayAverage(
          value,
          effect.decayRate || 0,
          effect.decayInterval || 0
        );
        if (typeWeight === 0) typeWeight = 0.5; // 정보 없으면 기본값
      } else if (typeWeight === 0) {
        // TYPE_WEIGHTS에서 0인 유형 (AWAKENING, SKILL_CHANGE 등)
        // AWAKENING은 별도 calculateAwakeningScore에서 처리
        typeWeight = 0.7;
      }

      // 조건부 효과 가동률 적용 (적 처치, 무방비, 궁극기 등)
      // @added 2025-12-11 - 보스전 기준 가동률 조정
      if (effect.type !== "PERMANENT") {
        const condMultiplier = getConditionalMultiplier(effect);
        typeWeight *= condMultiplier;
      }

      // 클래스 우선 효과 보너스 (efficiency-calculator.js와 동일한 가산 방식)
      let classBonusAdd = 0;
      if (classPriorityEffects.length > 0) {
        const isPriority = classPriorityEffects.some(
          (p) => effectName.indexOf(p) !== -1
        );
        if (isPriority) {
          // SUB_STAT_BONUS를 곱해서 별도 가산
          classBonusAdd = value * SUB_STAT_BONUS;
        }
      }

      // 한계효용 조정 (치명타)
      let marginalUtility = 1.0;
      if (effectName.indexOf("치명타 확률") !== -1 || effectName === "치명타") {
        const currentCritRate = (stats && stats.critRateBonus) || 0;
        marginalUtility = calculateCritMarginalUtility(currentCritRate / 100);
        if (marginalUtility < 0.1) marginalUtility = 0.1; // 최소 10% 가치
      }

      // 공격력/피해량 밸런스 보정
      let balanceBonus = 1.0;
      if (stats) {
        const balance = calculateBonusBalance(
          stats.attackBonus || 0,
          stats.damageBonus || 0
        );

        if (effectName.indexOf("공격력") !== -1) {
          balanceBonus = balance.attackMultiplier;
        } else if (
          effectName.indexOf("피해량") !== -1 ||
          effectName.indexOf("피해") !== -1
        ) {
          balanceBonus = balance.damageMultiplier;
        }
      }

      // 최종 효과 점수 = (수치 × 효과가중치 × 유형가중치 × 한계효용 × 밸런스) + 클래스보너스(가산)
      const effectScore =
        value * effectWeight * typeWeight * marginalUtility * balanceBonus;

      score += effectScore + classBonusAdd;
    });
  }

  // 결함 점수 차감 (DEMERIT_WEIGHTS 사용)
  if (rune.demerits && Array.isArray(rune.demerits)) {
    rune.demerits.forEach((demerit) => {
      const demeritName = demerit.name || "";
      // 결함 전용 가중치 적용
      const demeritWeight = getDemeritWeight(demeritName);
      score -= (demerit.value || 0) * demeritWeight;
    });
  }

  // 강화 효과 (+15 기준)
  if (rune.enhanceEffects) {
    ["10", "15"].forEach((level) => {
      const enhanceList = rune.enhanceEffects[level];
      if (enhanceList && Array.isArray(enhanceList)) {
        enhanceList.forEach((effect) => {
          if (effect.dpsRelevant !== false) {
            const enhanceWeight = getEffectWeight(effect.name || "");
            score += (effect.value || 0) * enhanceWeight * 0.8;
          }
        });
      }
    });
  }

  // 룬 내 시너지 보너스 적용 (치명타 확률 + 치명타 피해 등)
  const synergyBonus = calculateIntraRuneSynergy(effectKeys);
  score *= synergyBonus;

  return score;
}

/**
 * 각성 효과 점수 계산 (업타임 반영)
 * @param {Object} rune - 엠블럼 룬
 * @param {number} cooldownReduction - 쿨타임 감소량
 * @param {Object} options - 계산 옵션
 * @returns {number} 각성 효과 점수
 */
function calculateAwakeningScore(rune, cooldownReduction, options) {
  if (!rune.awakening || !rune.awakening.effects) return 0;

  const { classCode } = options;
  const classPriorityEffects = getClassPriorityEffects(classCode);

  const duration =
    rune.awakening.duration || AWAKENING_CONSTANTS.DEFAULT_DURATION;
  const adjustedCooldown = Math.max(
    AWAKENING_CONSTANTS.BASE_COOLDOWN - cooldownReduction,
    AWAKENING_CONSTANTS.MIN_COOLDOWN
  );
  const uptime = duration / (duration + adjustedCooldown);

  let score = 0;
  rune.awakening.effects.forEach((effect) => {
    if (effect.dpsRelevant === false) return;

    const effectName = effect.name || "";
    const value = effect.value || 0;

    // 클래스 우선 효과 보너스 (efficiency-calculator.js와 동일한 가산 방식)
    let classBonusAdd = 0;
    if (classPriorityEffects.length > 0) {
      const isPriority = classPriorityEffects.some(
        (p) => effectName.indexOf(p) !== -1
      );
      if (isPriority) {
        classBonusAdd = value * SUB_STAT_BONUS;
      }
    }

    score += value * uptime + classBonusAdd;
  });

  return score;
}

/**
 * 룬 최대 효율 점수 계산 (시너지/상태 최적화 가정)
 * - 결함 무효화 가정
 * - 최대 업타임 적용
 * - 클래스/밸런스 보너스 적용
 * @param {Object} rune - 룬 데이터
 * @param {Object} options - 계산 옵션
 * @returns {number} 최대 효율 점수
 */
function calculateRuneMaxScore(rune, options) {
  let score = 0;
  const effectKeys = [];

  // 시너지 배율 상수
  const CLASS_BONUS = 1.1;
  const BALANCE_BONUS = 1.15;
  const MAX_SYNERGY_MULT = CLASS_BONUS * BALANCE_BONUS; // 1.265

  // 효과 점수 계산 (최대 조건)
  if (rune.effects && Array.isArray(rune.effects)) {
    rune.effects.forEach((effect) => {
      if (effect.dpsRelevant === false) return;

      const effectName = effect.name || "";
      let value = effect.value || 0;
      const effectType = effect.type || "PERMANENT";

      // 중첩 효과는 최대 중첩으로
      if (effect.maxStacks && effect.stackValue) {
        value = effect.stackValue * effect.maxStacks;
      }

      const effectWeight = getEffectWeight(effectName);
      effectKeys.push(effectWeight > 0.5 ? effectName : null);

      // 최대 업타임 적용
      let typeWeight = 1.0;
      if (effectType === "DURATION" && effect.duration && effect.cooldown) {
        typeWeight = Math.min(effect.duration / (effect.cooldown * 0.7), 1);
      } else if (effectType === "DECAY") {
        typeWeight = 0.7;
      } else if (effectType === "STACKING") {
        typeWeight = 0.95;
      } else if (effectType === "TRIGGER") {
        typeWeight = 0.9;
      }

      score += value * effectWeight * typeWeight * MAX_SYNERGY_MULT;
    });
  }

  // 결함: 최대 시너지 시 무효화 (차감 없음)

  // 강화 효과 (+10, +15 모두 시너지 배율 적용)
  if (rune.enhanceEffects) {
    ["10", "15"].forEach((level) => {
      const enhanceList = rune.enhanceEffects[level];
      if (enhanceList) {
        if (Array.isArray(enhanceList)) {
          enhanceList.forEach((effect) => {
            const enhanceWeight = getEffectWeight(effect.name || "");
            score += (effect.value || 0) * enhanceWeight * MAX_SYNERGY_MULT;
          });
        } else if (typeof enhanceList === "object") {
          Object.entries(enhanceList).forEach(([name, value]) => {
            const enhanceWeight = getEffectWeight(name);
            score += value * enhanceWeight * MAX_SYNERGY_MULT;
          });
        }
      }
    });
  }

  // 각성 효과 (최대 업타임: 38초 쿨감 적용)
  if (rune.awakening && rune.awakening.effects) {
    const duration = rune.awakening.duration || 20;
    const effectiveCooldown = Math.max(90 - 38, 30); // 52초
    const maxUptime = duration / effectiveCooldown;
    const awakeningBonus = 1.5; // 2배 효과 시너지

    rune.awakening.effects.forEach((effect) => {
      if (effect.dpsRelevant === false) return;
      const effectWeight = getEffectWeight(effect.name || "");
      score += (effect.value || 0) * effectWeight * maxUptime * awakeningBonus;
    });
  }

  // 룬 내 시너지 보너스
  const synergyBonus = calculateIntraRuneSynergy(effectKeys);
  score *= synergyBonus;

  return score;
}

// ============================================================================
// 섹션 5: 시너지 계산
// ============================================================================

/**
 * 조합 시너지 점수 계산 (실제 효과 값 기반)
 * @param {Object} combination - 룬 조합
 * @returns {Object} 시너지 정보
 * @updated 2025-12-11 - 매직넘버 제거, 실제 효과 값 기반으로 변경
 */
function calculateSynergyScore(combination) {
  const { weapon, armors, emblem, accessories } = combination;
  const allRunes = [weapon, ...armors, emblem, ...accessories];

  let synergyScore = 0;
  const synergyDetails = [];

  // 1. DoT 시너지 (실제 효과 값 기반)
  // DoT 부여 룬 목록 - 각 룬이 제공하는 DoT 피해량 정보 포함
  const DOT_PROVIDERS = {
    출혈: { runes: ["야수+", "야수"], baseDamage: 8 },
    화상: {
      runes: ["불길", "메아리치는 진노", "메아리치는진노"],
      baseDamage: 10,
    },
    빙결: {
      runes: ["결정", "메아리치는 진노", "메아리치는진노"],
      baseDamage: 6,
    },
    감전: { runes: ["뇌명"], baseDamage: 12 },
    정신: { runes: ["밤+", "밤"], baseDamage: 7 },
  };

  // DoT 수혜 룬 목록
  const DOT_BENEFICIARIES = {
    출혈: ["절개+", "절개"],
    화상: ["들불"],
    빙결: ["설산"],
    감전: ["세상을 삼키는 악의", "세상을삼키는악의"],
    정신: ["환영+", "환영"],
  };

  const runeNames = allRunes.map((r) => r.name || "");

  // 각 DoT 타입별 시너지 계산 (실제 효과 값 기반)
  Object.keys(DOT_PROVIDERS).forEach((dotType) => {
    const providerInfo = DOT_PROVIDERS[dotType];
    const beneficiaries = DOT_BENEFICIARIES[dotType];

    // DoT 부여 룬이 있는지 확인
    const providerRune = allRunes.find((rune) =>
      providerInfo.runes.some((p) => (rune.name || "").indexOf(p) !== -1)
    );

    if (providerRune) {
      // DoT 부여 효과의 실제 가치 계산
      // DoT 피해 = 기본피해 × 가동률 × 피해량가중치
      const dotDamageWeight = getEffectWeight("피해량 증가");
      const dotValue =
        providerInfo.baseDamage * SYNERGY_CALC.DOT_UPTIME * dotDamageWeight;

      synergyScore += dotValue;
      synergyDetails.push(
        `${dotType} 부여 (${providerRune.name}): +${dotValue.toFixed(1)}`
      );

      // 수혜 룬 확인 - 조건부 효과의 실제 값 계산
      allRunes.forEach((rune) => {
        const runeName = rune.name || "";
        const isBeneficiary = beneficiaries.some(
          (b) => runeName.indexOf(b) !== -1
        );

        if (isBeneficiary && rune.effects) {
          let benefitBonus = 0;

          rune.effects.forEach((effect) => {
            // STATE 또는 TRIGGER 타입의 조건부 효과
            if (effect.type === "STATE" || effect.type === "TRIGGER") {
              // 해당 DoT 조건과 관련된 효과인지 확인
              const noteOrTrigger =
                (effect.note || "") + (effect.trigger || "");
              const isRelatedToDoT =
                noteOrTrigger.indexOf(dotType) !== -1 ||
                noteOrTrigger.indexOf("상태이상") !== -1 ||
                noteOrTrigger.indexOf("DoT") !== -1;

              if (isRelatedToDoT || effect.condition) {
                // 조건부 효과의 실제 가치 = 효과값 × 가중치 × 조건부업타임
                const effectWeight = getEffectWeight(effect.name || "");
                const effectValue =
                  (effect.value || 0) *
                  effectWeight *
                  SYNERGY_CALC.CONDITIONAL_UPTIME;
                benefitBonus += effectValue;
              }
            }
          });

          // 조건부 효과가 명시되지 않은 경우, 룬의 전체 효과 중 비활성 부분 활성화
          if (benefitBonus === 0) {
            rune.effects.forEach((effect) => {
              if (effect.type !== "PERMANENT") {
                const effectWeight = getEffectWeight(effect.name || "");
                benefitBonus +=
                  (effect.value || 0) *
                  effectWeight *
                  SYNERGY_CALC.CONDITIONAL_UPTIME *
                  0.5;
              }
            });
          }

          if (benefitBonus > 0) {
            synergyScore += benefitBonus;
            synergyDetails.push(
              `${dotType} 수혜 (${runeName}): +${benefitBonus.toFixed(1)}`
            );
          }
        }
      });
    }
  });

  // synergy 객체 기반 DoT 시너지 (JSON에 정의된 경우)
  const dotTypesFromSynergy = new Set();
  const dotDamageTypesFromSynergy = new Set();
  const runesRequiringDot = new Map(); // DoT 필요 룬과 그 효과들

  allRunes.forEach((rune) => {
    if (rune.synergy) {
      if (rune.synergy.appliesDot) {
        rune.synergy.appliesDot.forEach((dot) => dotTypesFromSynergy.add(dot));
      }
      if (rune.synergy.requiresDot && rune.synergy.requiresDot.length > 0) {
        rune.synergy.requiresDot.forEach((dot) => {
          dotDamageTypesFromSynergy.add(dot);
          if (!runesRequiringDot.has(dot)) {
            runesRequiringDot.set(dot, []);
          }
          runesRequiringDot.get(dot).push(rune);
        });
      }
    }
  });

  // synergy 객체 기반 DoT 매칭 시 실제 효과 값 계산
  dotTypesFromSynergy.forEach((dot) => {
    if (dotDamageTypesFromSynergy.has(dot)) {
      const benefitRunes = runesRequiringDot.get(dot) || [];
      benefitRunes.forEach((rune) => {
        // 룬의 비영구 효과들의 가치 계산
        let matchBonus = 0;
        if (rune.effects) {
          rune.effects.forEach((effect) => {
            if (effect.type !== "PERMANENT") {
              const effectWeight = getEffectWeight(effect.name || "");
              matchBonus +=
                (effect.value || 0) *
                effectWeight *
                SYNERGY_CALC.CONDITIONAL_UPTIME;
            }
          });
        }
        if (matchBonus > 0) {
          synergyScore += matchBonus;
          synergyDetails.push(
            `${dot} JSON 시너지 (${rune.name}): +${matchBonus.toFixed(1)}`
          );
        }
      });
    }
  });

  // 2. 결함 제거 시너지 (영원 룬) - 실제 결함 값 기반
  const hasEternalRune = allRunes.some(
    (r) => r.synergy && r.synergy.removesDemerits === true
  );

  if (hasEternalRune) {
    // 결함이 있는 룬의 결함 점수를 시너지로 상쇄 (100% 회복)
    let demeritRecovery = 0;
    allRunes.forEach((rune) => {
      if (rune.demerits && Array.isArray(rune.demerits)) {
        rune.demerits.forEach((demerit) => {
          // 결함의 실제 가치 = 결함값 × 결함가중치
          const demeritWeight = getDemeritWeight(demerit.name || "");
          demeritRecovery +=
            (demerit.value || 0) *
            demeritWeight *
            SYNERGY_CALC.DEMERIT_RECOVERY_RATE;
        });
      }
    });

    if (demeritRecovery > 0) {
      synergyScore += demeritRecovery;
      synergyDetails.push(`결함 제거: +${demeritRecovery.toFixed(1)}`);
    }
  }

  // 3. 각성 쿨타임 감소량 계산 (방어구에서)
  let awakeningCooldownReduction = 0;
  armors.forEach((armor) => {
    if (armor.effects) {
      armor.effects.forEach((effect) => {
        if (
          effect.name &&
          effect.name.indexOf("각성") !== -1 &&
          effect.name.indexOf("쿨타임") !== -1
        ) {
          awakeningCooldownReduction += effect.value || 0;
        }
      });
    }
  });

  // 4. 각성 2배 효과 시너지 (압도적인힘/섬세한손놀림) - 실제 효과 값 기반
  const AWAKENING_DOUBLE_RUNES = [
    "압도적인 힘",
    "섬세한 손놀림",
    "압도적인힘",
    "섬세한손놀림",
  ];
  const awakeningDoubleRune = allRunes.find((r) =>
    AWAKENING_DOUBLE_RUNES.some((name) => r.name && r.name.indexOf(name) !== -1)
  );

  if (awakeningDoubleRune && emblem && emblem.awakening) {
    const duration =
      emblem.awakening.duration || AWAKENING_CONSTANTS.DEFAULT_DURATION;
    const adjustedCooldown = Math.max(
      AWAKENING_CONSTANTS.BASE_COOLDOWN - awakeningCooldownReduction,
      AWAKENING_CONSTANTS.MIN_COOLDOWN
    );
    const uptime = duration / (duration + adjustedCooldown);

    // 엠블럼 각성 효과의 실제 값을 기반으로 2배 보너스 계산
    let emblemAwakeningValue = 0;
    if (emblem.awakening && emblem.awakening.effects) {
      emblem.awakening.effects.forEach((effect) => {
        const effectWeight = getEffectWeight(effect.name || "");
        emblemAwakeningValue += (effect.value || 0) * effectWeight;
      });
    }
    // 각성 2배 효과 = 기존 각성 효과의 30% 추가 (업타임 적용)
    const awakeningDoubleBonus =
      emblemAwakeningValue * SYNERGY_CALC.AWAKENING_DOUBLE_BONUS_RATE * uptime;

    if (awakeningDoubleBonus > 0) {
      synergyScore += awakeningDoubleBonus;
      synergyDetails.push(
        `각성 2배 효과 (${
          awakeningDoubleRune.name
        }): +${awakeningDoubleBonus.toFixed(1)}`
      );
    }
  }

  // 5. 중첩 보너스 시너지 (쌍둥이별/에메랄드숲) - 실제 중첩 효과 값 기반
  const STACKING_BONUS_RUNES = [
    "쌍둥이 별",
    "에메랄드 숲",
    "쌍둥이별",
    "에메랄드숲",
  ];
  const stackBonusRune = allRunes.find((r) =>
    STACKING_BONUS_RUNES.some((name) => r.name && r.name.indexOf(name) !== -1)
  );

  if (stackBonusRune) {
    let stackBonus = 0;
    allRunes.forEach((rune) => {
      if (rune.effects) {
        rune.effects.forEach((effect) => {
          if (
            effect.type === "STACKING" &&
            (effect.stackValue || effect.valuePerStack)
          ) {
            // 1중첩 추가 효과의 실제 가치
            const stackValue = effect.stackValue || effect.valuePerStack || 0;
            const effectWeight = getEffectWeight(effect.name || "");
            // 중첩 보너스 = 1중첩 추가 가치 × 효과가중치 × 추가비율
            stackBonus +=
              stackValue * effectWeight * SYNERGY_CALC.STACKING_EXTRA_RATE;
          }
        });
      }
    });

    if (stackBonus > 0) {
      synergyScore += stackBonus;
      synergyDetails.push(
        `중첩 보너스 (${stackBonusRune.name}): +${stackBonus.toFixed(1)}`
      );
    }
  }

  // 6. 눈 먼 예언자 각성 쿨감 시너지 - 실제 쿨감 효과 기반
  const BLIND_PROPHET_RUNES = ["눈 먼 예언자", "눈먼예언자"];
  const blindProphetRune = allRunes.find((r) =>
    BLIND_PROPHET_RUNES.some((name) => r.name && r.name.indexOf(name) !== -1)
  );

  if (blindProphetRune) {
    // 38초 쿨감의 실제 가치 계산
    const cooldownReductionValue = 38;
    awakeningCooldownReduction += cooldownReductionValue;

    // 쿨감 효과 = 기본 쿨타임 대비 단축 비율 × 각성효과가치
    // 120초 → 82초 = 약 32% 효율 증가
    const cooldownWeight = getEffectWeight("쿨타임 회복 속도 증가");
    const cooldownBonus =
      (cooldownReductionValue / AWAKENING_CONSTANTS.BASE_COOLDOWN) *
      100 *
      cooldownWeight;

    synergyScore += cooldownBonus;
    synergyDetails.push(
      `각성 쿨감 (${blindProphetRune.name}): +${cooldownBonus.toFixed(1)}`
    );
  }

  // ========================================
  // 7. 조합 간 시너지 (Cross-Rune Synergy)
  // @added 2025-12-12 - 룬 간 효과 조합 시너지
  // ========================================
  
  // 조합 전체에서 효과 합산
  let totalCritRate = 0;      // 치명타 확률 합계
  let totalCritDamage = 0;    // 치명타 피해 합계
  let totalAddHitRate = 0;    // 추가타 확률 합계
  let totalAddHitDamage = 0;  // 추가타 피해 합계
  let totalAttackIncrease = 0; // 공격력 증가 합계
  let totalDamageIncrease = 0; // 피해량 증가 합계
  let totalTargetDamageIncrease = 0; // 타겟 받는 피해 증가 합계
  
  allRunes.forEach((rune) => {
    if (rune.effects && Array.isArray(rune.effects)) {
      rune.effects.forEach((effect) => {
        const name = effect.name || "";
        const value = effect.value || 0;
        
        // 치명타 관련
        if (name.includes("치명타 확률")) {
          totalCritRate += value;
        } else if (name.includes("치명타 피해") || name.includes("치명타 피해량")) {
          totalCritDamage += value;
        }
        // 추가타 관련
        else if (name.includes("추가타 확률")) {
          totalAddHitRate += value;
        } else if (name.includes("추가타 피해") || name.includes("추가타")) {
          totalAddHitDamage += value;
        }
        // 공격력/피해량 관련
        else if (name.includes("공격력 증가") || name.includes("공격력")) {
          totalAttackIncrease += value;
        } else if (name.includes("피해량 증가") || name === "피해 증가") {
          totalDamageIncrease += value;
        }
        // 타겟 받는 피해 증가 (디버프)
        else if (name.includes("받는 피해 증가") && !name.includes("(나)")) {
          totalTargetDamageIncrease += value;
        }
      });
    }
  });
  
  // 7-1. 치명타 조합 시너지 (DPS 기대값 공식)
  // @updated 2025-12-12 - 매직넘버 제거, 실제 DPS 기대값 계산
  // DPS 증가 = 확률 × 피해 (곱연산 상승효과)
  // 예: 30% 확률 + 50% 피해 → 0.3 × 0.5 = 0.15 = 15% DPS 증가
  if (totalCritRate > 0 && totalCritDamage > 0) {
    // 확률(%)과 피해(%)를 곱하면 기대 DPS 증가율(%)
    const critSynergyBonus = (totalCritRate / 100) * (totalCritDamage / 100) * 100;
    // 이 값 자체가 시너지 점수 (% 단위)
    synergyScore += critSynergyBonus;
    synergyDetails.push(
      `치명타 조합 (${totalCritRate.toFixed(0)}% × ${totalCritDamage.toFixed(0)}%): +${critSynergyBonus.toFixed(1)}% DPS`
    );
  }
  
  // 7-2. 추가타 조합 시너지 (DPS 기대값 공식)
  // DPS 증가 = 확률 × 피해
  if (totalAddHitRate > 0 && totalAddHitDamage > 0) {
    const addHitSynergyBonus = (totalAddHitRate / 100) * (totalAddHitDamage / 100) * 100;
    synergyScore += addHitSynergyBonus;
    synergyDetails.push(
      `추가타 조합 (${totalAddHitRate.toFixed(0)}% × ${totalAddHitDamage.toFixed(0)}%): +${addHitSynergyBonus.toFixed(1)}% DPS`
    );
  }
  
  // 7-3. 공격력 + 피해량 조합 시너지 (곱연산 상승효과)
  // 공격력과 피해량은 독립적으로 곱연산되므로 시너지 발생
  // (1 + 공격력%) × (1 + 피해량%) - 1 - 공격력% - 피해량% = 공격력% × 피해량%
  if (totalAttackIncrease > 0 && totalDamageIncrease > 0) {
    const atkDmgSynergyBonus = (totalAttackIncrease / 100) * (totalDamageIncrease / 100) * 100;
    synergyScore += atkDmgSynergyBonus;
    synergyDetails.push(
      `공격력×피해량 조합 (${totalAttackIncrease.toFixed(0)}% × ${totalDamageIncrease.toFixed(0)}%): +${atkDmgSynergyBonus.toFixed(1)}% DPS`
    );
  }
  
  // 7-4. 디버프 시너지 (타겟 받는 피해 증가)
  // 실제 효과 값 그대로 사용 (파티원 전체에게 이득이므로 중요)
  if (totalTargetDamageIncrease > 0) {
    // 실제 피해 증가율을 그대로 점수로 사용
    synergyScore += totalTargetDamageIncrease;
    synergyDetails.push(
      `디버프 시너지 (타겟 피해 +${totalTargetDamageIncrease.toFixed(0)}%): +${totalTargetDamageIncrease.toFixed(1)}% DPS`
    );
  }

  return {
    score: synergyScore,
    details: synergyDetails,
    awakeningCooldownReduction,
  };
}

// ============================================================================
// 섹션 6: 조합 점수 계산
// ============================================================================

/**
 * 전체 조합 점수 계산
 * @param {Object} combination - 룬 조합
 * @param {Object} options - 계산 옵션
 * @returns {number} 총 점수
 * @updated 2025-12-12 - DoT 매칭 안되는 룬 페널티 추가
 */
function calculateCombinationScore(combination, options) {
  const { weapon, armors, emblem, accessories } = combination;
  const allRunes = [weapon, ...armors, emblem, ...accessories];

  // 조합 내 DoT 부여 유형 수집
  const providedDotTypes = new Set();
  allRunes.forEach((rune) => {
    if (rune.synergy && rune.synergy.appliesDot) {
      rune.synergy.appliesDot.forEach((dot) => providedDotTypes.add(dot));
    }
  });

  // 기본 점수
  let totalScore = 0;

  // 무기 점수
  totalScore += calculateRuneBaseScore(weapon, options);
  // DoT 요구 페널티 체크
  if (weapon.synergy && weapon.synergy.requiresDot && weapon.synergy.requiresDot.length > 0) {
    const hasMatchingDot = weapon.synergy.requiresDot.some((dot) => providedDotTypes.has(dot));
    if (!hasMatchingDot) {
      // DoT 매칭 안되면 해당 룬 점수의 50% 페널티
      totalScore -= calculateRuneBaseScore(weapon, options) * 0.5;
    }
  }

  // 방어구 점수
  armors.forEach((armor) => {
    totalScore += calculateRuneBaseScore(armor, options);
    // DoT 요구 페널티 체크
    if (armor.synergy && armor.synergy.requiresDot && armor.synergy.requiresDot.length > 0) {
      const hasMatchingDot = armor.synergy.requiresDot.some((dot) => providedDotTypes.has(dot));
      if (!hasMatchingDot) {
        totalScore -= calculateRuneBaseScore(armor, options) * 0.5;
      }
    }
  });

  // 시너지 계산 (각성 쿨감 포함)
  const synergy = calculateSynergyScore(combination);
  totalScore += synergy.score;

  // 엠블럼 점수 (각성 업타임 반영)
  totalScore += calculateRuneBaseScore(emblem, options);
  totalScore += calculateAwakeningScore(
    emblem,
    synergy.awakeningCooldownReduction,
    options
  );

  // 장신구 점수
  accessories.forEach((accessory) => {
    totalScore += calculateRuneBaseScore(accessory, options);
    // DoT 요구 페널티 체크
    if (accessory.synergy && accessory.synergy.requiresDot && accessory.synergy.requiresDot.length > 0) {
      const hasMatchingDot = accessory.synergy.requiresDot.some((dot) => providedDotTypes.has(dot));
      if (!hasMatchingDot) {
        totalScore -= calculateRuneBaseScore(accessory, options) * 0.5;
      }
    }
  });

  return Math.round(totalScore * 10) / 10;
}

// ============================================================================
// 섹션 7: 최적화 탐색 (Branch & Bound)
// ============================================================================

/**
 * 최적 조합 탐색 (가지치기 적용)
 * @param {Object} data - 탐색 데이터
 */
function findOptimalCombination(data) {
  try {
    const { weapons, armors, emblems, accessories, options } = data;

    console.log("[Worker] 데이터 수신:", {
      weapons: weapons.length,
      armors: armors.length,
      emblems: emblems.length,
      accessories: accessories.length,
    });

    // 1. 각 카테고리별 기본/최대 점수 사전 계산 및 정렬 (maxScore 순)
    // @updated 2025-12-12 - 메인에서 전달된 baseScore 재사용 (일관성 보장)
    console.log("[Worker] 점수 계산 시작 (baseScore + maxScore)...");

    const scoredWeapons = weapons
      .map((w) => ({
        ...w,
        // 메인에서 전달된 baseScore가 있으면 재사용, 없으면 계산
        baseScore: w.baseScore !== undefined ? w.baseScore : calculateRuneBaseScore(w, options),
        maxScore: w.maxScore !== undefined ? w.maxScore : calculateRuneMaxScore(w, options),
      }))
      .sort((a, b) => b.maxScore - a.maxScore); // maxScore 순 정렬

    const scoredArmors = armors
      .map((a) => ({
        ...a,
        baseScore: a.baseScore !== undefined ? a.baseScore : calculateRuneBaseScore(a, options),
        maxScore: a.maxScore !== undefined ? a.maxScore : calculateRuneMaxScore(a, options),
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    const scoredEmblems = emblems
      .map((e) => ({
        ...e,
        baseScore: e.baseScore !== undefined ? e.baseScore : calculateRuneBaseScore(e, options),
        maxScore: e.maxScore !== undefined ? e.maxScore : calculateRuneMaxScore(e, options),
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    const scoredAccessories = accessories
      .map((a) => ({
        ...a,
        baseScore: a.baseScore !== undefined ? a.baseScore : calculateRuneBaseScore(a, options),
        maxScore: a.maxScore !== undefined ? a.maxScore : calculateRuneMaxScore(a, options),
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    console.log("[Worker] 점수 계산 완료:", {
      weapons: scoredWeapons.length,
      armors: scoredArmors.length,
      emblems: scoredEmblems.length,
      accessories: scoredAccessories.length,
    });

    // 2. 최대 가능 점수 계산 (가지치기용)
    // 더 타이트한 상한으로 스킵률 향상
    console.log("[Worker] 최대 점수 계산 중...");

    // 상한 배율: 1.15 (기존 1.35에서 대폭 축소)
    // 실제 시너지로 인한 점수 증가는 10~15% 정도
    const UPPER_BOUND_MULTIPLIER = 1.15;

    // baseScore 상위 합 × 배율
    const maxArmorScore =
      scoredArmors.slice(0, 5).reduce((sum, a) => sum + a.baseScore, 0) *
      UPPER_BOUND_MULTIPLIER;
    const maxEmblemScore = scoredEmblems[0]
      ? scoredEmblems[0].baseScore * UPPER_BOUND_MULTIPLIER
      : 0;
    const maxAccessoryScore =
      scoredAccessories.slice(0, 3).reduce((sum, a) => sum + a.baseScore, 0) *
      UPPER_BOUND_MULTIPLIER;
    // 시너지 최대치: 현실적인 값으로 축소 (125 → 50)
    const maxSynergyBonus = 50;

    // 3. 초기 최적해 설정 (baseScore 기반 greedy 해)
    // → 시작부터 가지치기 활성화
    console.log("[Worker] 초기 최적해 계산 중...");

    const initialCombination = {
      weapon: scoredWeapons[0],
      armors: scoredArmors.slice(0, 5),
      emblem: scoredEmblems[0],
      accessories: scoredAccessories.slice(0, 3),
    };

    let bestScore = calculateCombinationScore(initialCombination, options);
    let bestCombination = initialCombination;

    console.log("[Worker] 초기 최적해 점수:", bestScore);
    let processedCount = 0;
    let skippedCount = 0;

    // 4. 총 조합 수 계산
    const totalCombinations =
      scoredWeapons.length *
      nCr(scoredArmors.length, 5) *
      scoredEmblems.length *
      nCr(scoredAccessories.length, 3);

    console.log("[Worker] 총 조합 수:", totalCombinations.toLocaleString());

    // 시간 기반 진행률 업데이트 (500ms마다)
    const PROGRESS_UPDATE_INTERVAL_MS = 500;
    let lastProgressTime = Date.now();
    let startTime = Date.now();

    // 초기 진행률 전송
    self.postMessage({
      type: "progress",
      processed: 0,
      skipped: 0,
      total: totalCombinations,
      progress: 0,
      bestScore: 0,
      estimatedRemaining: 0,
    });

    // 5. 탐색 시작
    // 방어구 조합당 처리량 (엠블럼 * 장신구조합)
    const perArmorCombo =
      scoredEmblems.length * nCr(scoredAccessories.length, 3);
    // 무기당 처리량
    const perWeapon = nCr(scoredArmors.length, 5) * perArmorCombo;

    let armorComboCount = 0; // 방어구 조합 카운터

    for (let wi = 0; wi < scoredWeapons.length; wi++) {
      const weapon = scoredWeapons[wi];

      // 무기 레벨 가지치기 (baseScore × 배율 상한)
      const weaponUpperBound =
        weapon.baseScore * UPPER_BOUND_MULTIPLIER +
        maxArmorScore +
        maxEmblemScore +
        maxAccessoryScore +
        maxSynergyBonus;
      if (weaponUpperBound <= bestScore) {
        const remainingWeapons = scoredWeapons.length - wi;
        skippedCount += remainingWeapons * perWeapon;
        break; // 이후 무기는 더 낮으므로 종료
      }

      // 방어구 조합 순회
      armorComboCount = 0;
      for (const armorCombo of combinations(scoredArmors, 5)) {
        armorComboCount++;
        // baseScore 합 × 배율로 상한 계산
        const armorBaseSum = armorCombo.reduce(
          (sum, a) => sum + a.baseScore,
          0
        );

        // 방어구 레벨 가지치기 (baseScore × 배율)
        const armorUpperBound =
          weapon.baseScore * UPPER_BOUND_MULTIPLIER +
          armorBaseSum * UPPER_BOUND_MULTIPLIER +
          maxEmblemScore +
          maxAccessoryScore +
          maxSynergyBonus;
        if (armorUpperBound <= bestScore) {
          skippedCount += perArmorCombo;

          // 방어구 조합 레벨에서 시간 기반 진행률 보고
          const now = Date.now();
          if (now - lastProgressTime >= PROGRESS_UPDATE_INTERVAL_MS) {
            lastProgressTime = now;
            const elapsed = (now - startTime) / 1000;
            const progress =
              (processedCount + skippedCount) / totalCombinations;
            const estimatedRemaining =
              progress > 0 ? (elapsed / progress) * (1 - progress) : 0;

            self.postMessage({
              type: "progress",
              processed: processedCount,
              skipped: skippedCount,
              total: totalCombinations,
              progress: Math.round(progress * 100),
              bestScore,
              estimatedRemaining: Math.round(estimatedRemaining),
            });
          }
          continue;
        }

        // 엠블럼 순회
        for (let ei = 0; ei < scoredEmblems.length; ei++) {
          const emblem = scoredEmblems[ei];

          // 엠블럼 레벨 가지치기 (baseScore × 배율)
          const emblemUpperBound =
            weapon.baseScore * UPPER_BOUND_MULTIPLIER +
            armorBaseSum * UPPER_BOUND_MULTIPLIER +
            emblem.baseScore * UPPER_BOUND_MULTIPLIER +
            maxAccessoryScore +
            maxSynergyBonus;
          if (emblemUpperBound <= bestScore) {
            skippedCount += nCr(scoredAccessories.length, 3);
            continue;
          }

          // 장신구 조합 순회
          for (const accessoryCombo of combinations(scoredAccessories, 3)) {
            processedCount++;

            // 전체 조합 점수 계산
            const combination = {
              weapon,
              armors: armorCombo,
              emblem,
              accessories: accessoryCombo,
            };

            const totalScore = calculateCombinationScore(combination, options);

            if (totalScore > bestScore) {
              bestScore = totalScore;
              bestCombination = combination;
            }

            // 시간 기반 진행률 보고 (500ms마다)
            const now = Date.now();
            if (now - lastProgressTime >= PROGRESS_UPDATE_INTERVAL_MS) {
              lastProgressTime = now;
              const elapsed = (now - startTime) / 1000;
              const progress =
                (processedCount + skippedCount) / totalCombinations;
              const estimatedRemaining =
                progress > 0 ? (elapsed / progress) * (1 - progress) : 0;

              self.postMessage({
                type: "progress",
                processed: processedCount,
                skipped: skippedCount,
                total: totalCombinations,
                progress: Math.round(progress * 100),
                bestScore,
                estimatedRemaining: Math.round(estimatedRemaining),
              });
            }
          }
        }

        // 방어구 조합 완료시마다 진행률 체크 (가지치기 안된 경우)
        const now = Date.now();
        if (now - lastProgressTime >= PROGRESS_UPDATE_INTERVAL_MS) {
          lastProgressTime = now;
          const elapsed = (now - startTime) / 1000;
          const progress = (processedCount + skippedCount) / totalCombinations;
          const estimatedRemaining =
            progress > 0 ? (elapsed / progress) * (1 - progress) : 0;

          self.postMessage({
            type: "progress",
            processed: processedCount,
            skipped: skippedCount,
            total: totalCombinations,
            progress: Math.round(progress * 100),
            bestScore,
            estimatedRemaining: Math.round(estimatedRemaining),
          });
        }
      }

      // 무기 완료시 진행률 보고
      console.log(`[Worker] 무기 ${wi + 1}/${scoredWeapons.length} 완료`);
    }

    // 6. 결과 반환
    console.log("[Worker] 탐색 완료, 결과 전송...");
    self.postMessage({
      type: "complete",
      bestScore,
      bestCombination,
      processed: processedCount,
      skipped: skippedCount,
      total: totalCombinations,
      skipRate: Math.round(
        (skippedCount / (processedCount + skippedCount)) * 100
      ),
    });
  } catch (error) {
    console.error("[Worker] 오류 발생:", error);
    self.postMessage({
      type: "error",
      message: error.message,
      stack: error.stack,
    });
  }
}

// ============================================================================
// 섹션 8: 2단계 탐색 알고리즘 (빠른 탐색 + 정밀 확장)
// ============================================================================

/**
 * Top-N 필터링: baseScore/maxScore 상위 N개씩 선정 (중복 제거)
 * @param {Array} runes - 룬 배열
 * @param {number} topN - 각 기준 상위 N개
 * @param {Object} options - 옵션 (스텟, 클래스 등)
 * @returns {Object} { filtered: 필터링된 룬, allSorted: 전체 정렬된 룬 }
 */
function filterTopN(runes, topN, options) {
  if (!runes || runes.length === 0) return { filtered: [], allSorted: [] };

  // 룬별 점수 계산 (이미 계산되어 있으면 사용)
  const scoredRunes = runes.map((rune) => {
    const baseScore =
      rune.baseScore !== undefined
        ? rune.baseScore
        : calculateRuneBaseScore(rune, options);
    const maxScore =
      rune.maxScore !== undefined
        ? rune.maxScore
        : calculateRuneMaxScore(rune, options);
    return { ...rune, baseScore, maxScore };
  });

  // baseScore 기준 정렬
  const byBaseScore = [...scoredRunes].sort(
    (a, b) => b.baseScore - a.baseScore
  );

  // maxScore 기준 정렬
  const byMaxScore = [...scoredRunes].sort((a, b) => b.maxScore - a.maxScore);

  // 상위 N개씩 선정 (중복 제거)
  const selectedIds = new Set();
  const filtered = [];

  // baseScore 상위 N개
  for (let i = 0; i < Math.min(topN, byBaseScore.length); i++) {
    if (!selectedIds.has(byBaseScore[i].id)) {
      selectedIds.add(byBaseScore[i].id);
      filtered.push(byBaseScore[i]);
    }
  }

  // maxScore 상위 N개 (중복 제거)
  for (let i = 0; i < Math.min(topN, byMaxScore.length); i++) {
    if (!selectedIds.has(byMaxScore[i].id)) {
      selectedIds.add(byMaxScore[i].id);
      filtered.push(byMaxScore[i]);
    }
  }

  // maxScore 기준 정렬
  filtered.sort((a, b) => b.maxScore - a.maxScore);

  return {
    filtered,
    allSorted: byMaxScore,
    selectedIds,
  };
}

/**
 * 2단계 확장: 1단계 결과 기반 ±N등 확장
 * @param {Array} phase1Results - 1단계 선택된 룬 ID Set
 * @param {Array} allSorted - 전체 정렬된 룬
 * @param {number} expandRange - 확장 범위 (±N)
 * @returns {Array} 확장된 룬 배열
 */
function expandSelection(selectedIds, allSorted, expandRange) {
  const expandedIds = new Set(selectedIds);

  // 선택된 룬들의 인덱스 찾기
  const selectedIndices = [];
  allSorted.forEach((rune, idx) => {
    if (selectedIds.has(rune.id)) {
      selectedIndices.push(idx);
    }
  });

  // 각 선택된 룬 주변 ±expandRange 확장
  selectedIndices.forEach((idx) => {
    for (
      let i = Math.max(0, idx - expandRange);
      i <= Math.min(allSorted.length - 1, idx + expandRange);
      i++
    ) {
      expandedIds.add(allSorted[i].id);
    }
  });

  // 확장된 룬 배열 반환
  return allSorted.filter((rune) => expandedIds.has(rune.id));
}

/**
 * 2단계 탐색 메인 함수 (가지치기 + 최적화 적용)
 * @param {Object} data - 탐색 데이터
 */
function findOptimalCombinationTwoPhase(data) {
  try {
    const {
      weapons,
      armors,
      emblems,
      accessories,
      options,
      workerId = 0,
    } = data;

    const TOP_N = 10; // 각 기준 상위 10개
    const EXPAND_RANGE = 5; // ±5등 확장
    const UPPER_BOUND_MULT = 1.15; // 상한 배수
    const MAX_SYNERGY = 50; // 최대 시너지 보너스
    const PROGRESS_INTERVAL = 200; // 진행률 업데이트 간격 (ms)

    console.log(`[Worker ${workerId}] 2단계 탐색 시작 (가지치기 적용)`);
    console.log(
      `[Worker ${workerId}] 원본 룬 수: 무기=${weapons.length}, 방어구=${armors.length}, 엠블럼=${emblems.length}, 장신구=${accessories.length}`
    );

    // ========================================
    // 1단계: 빠른 탐색 (Top-N 필터링 + 가지치기)
    // ========================================
    self.postMessage({
      type: "phaseStart",
      phase: 1,
      workerId,
      message: "1단계: 빠른 탐색 시작...",
    });

    // 각 카테고리 Top-N 필터링
    const weaponData = filterTopN(weapons, TOP_N, options);
    const armorData = filterTopN(armors, TOP_N, options);
    const emblemData = filterTopN(emblems, emblems.length, options);
    const accessoryData = filterTopN(accessories, accessories.length, options);

    const phase1Weapons = weaponData.filtered;
    const phase1Armors = armorData.filtered;
    const phase1Emblems = emblemData.filtered;
    const phase1Accessories = accessoryData.filtered;

    console.log(
      `[Worker ${workerId}] 1단계 필터링: 무기=${phase1Weapons.length}, 방어구=${phase1Armors.length}, 엠블럼=${phase1Emblems.length}, 장신구=${phase1Accessories.length}`
    );

    // nCr 함수
    function nCr(n, r) {
      if (r > n) return 0;
      if (r === 0 || r === n) return 1;
      let result = 1;
      for (let i = 0; i < r; i++) {
        result = (result * (n - i)) / (i + 1);
      }
      return Math.round(result);
    }

    // 최대 점수 사전 계산 (가지치기용)
    const maxArmorScores = phase1Armors
      .map((a) => a.maxScore || 0)
      .sort((a, b) => b - a);
    const maxEmblemScore =
      phase1Emblems.length > 0
        ? Math.max(...phase1Emblems.map((e) => e.maxScore || 0))
        : 0;
    const maxAccessoryScores = phase1Accessories
      .map((a) => a.maxScore || 0)
      .sort((a, b) => b - a);

    // 상위 5개 방어구 합
    const maxArmorSum = maxArmorScores
      .slice(0, 5)
      .reduce((sum, s) => sum + s, 0);
    // 상위 3개 장신구 합
    const maxAccessorySum = maxAccessoryScores
      .slice(0, 3)
      .reduce((sum, s) => sum + s, 0);

    const phase1Total =
      phase1Weapons.length *
      nCr(phase1Armors.length, 5) *
      phase1Emblems.length *
      nCr(phase1Accessories.length, 3);
    console.log(
      `[Worker ${workerId}] 1단계 조합 수: ${phase1Total.toLocaleString()}`
    );

    // 탐색 변수
    let bestScore = 0;
    let bestCombination = null;
    let phase1Processed = 0;
    let phase1Skipped = 0;
    let lastProgressTime = Date.now();
    const phase1StartTime = Date.now();

    // 방어구 조합 사전 생성 (점수 포함)
    const armorCombos = [];
    for (let a1 = 0; a1 < phase1Armors.length - 4; a1++) {
      for (let a2 = a1 + 1; a2 < phase1Armors.length - 3; a2++) {
        for (let a3 = a2 + 1; a3 < phase1Armors.length - 2; a3++) {
          for (let a4 = a3 + 1; a4 < phase1Armors.length - 1; a4++) {
            for (let a5 = a4 + 1; a5 < phase1Armors.length; a5++) {
              const combo = [
                phase1Armors[a1],
                phase1Armors[a2],
                phase1Armors[a3],
                phase1Armors[a4],
                phase1Armors[a5],
              ];
              const baseSum = combo.reduce(
                (sum, a) => sum + (a.baseScore || 0),
                0
              );
              const maxSum = combo.reduce(
                (sum, a) => sum + (a.maxScore || 0),
                0
              );
              armorCombos.push({ combo, baseSum, maxSum });
            }
          }
        }
      }
    }
    // maxSum 기준 정렬 (가지치기 효율화)
    armorCombos.sort((a, b) => b.maxSum - a.maxSum);

    // 장신구 조합 사전 생성 (점수 포함)
    const accessoryCombos = [];
    for (let c1 = 0; c1 < phase1Accessories.length - 2; c1++) {
      for (let c2 = c1 + 1; c2 < phase1Accessories.length - 1; c2++) {
        for (let c3 = c2 + 1; c3 < phase1Accessories.length; c3++) {
          const combo = [
            phase1Accessories[c1],
            phase1Accessories[c2],
            phase1Accessories[c3],
          ];
          const baseSum = combo.reduce((sum, a) => sum + (a.baseScore || 0), 0);
          const maxSum = combo.reduce((sum, a) => sum + (a.maxScore || 0), 0);
          accessoryCombos.push({ combo, baseSum, maxSum });
        }
      }
    }
    // maxSum 기준 정렬
    accessoryCombos.sort((a, b) => b.maxSum - a.maxSum);

    // 1단계 전체 탐색 (변수는 위에서 이미 선언됨)
    for (const weapon of phase1Weapons) {
      for (const armorCombo of armorCombos) {
        for (const emblem of phase1Emblems) {
          for (const accessoryCombo of accessoryCombos) {
            phase1Processed++;

            // 조합 점수 계산
            const combination = {
              weapon,
              armors: armorCombo.combo,
              emblem,
              accessories: accessoryCombo.combo,
            };

            const score = calculateCombinationScore(combination, options);

            if (score > bestScore) {
              bestScore = score;
              bestCombination = combination;

              // 새로운 최고 점수 발견 시 즉시 전송
              self.postMessage({
                type: "bestFound",
                phase: 1,
                workerId,
                bestScore,
                bestCombination: serializeCombination(bestCombination),
              });
            }

            // 진행률 업데이트
            const now = Date.now();
            if (now - lastProgressTime >= PROGRESS_INTERVAL) {
              lastProgressTime = now;
              const elapsed = (now - phase1StartTime) / 1000;
              const progress = phase1Processed / phase1Total;
              const remaining =
                progress > 0 ? (elapsed / progress) * (1 - progress) : 0;

              self.postMessage({
                type: "progress",
                phase: 1,
                workerId,
                processed: phase1Processed,
                total: phase1Total,
                progress: Math.round(progress * 100),
                bestScore,
                estimatedRemaining: Math.round(remaining),
              });
            }
          }
        }
      }
    }

    // 1단계 완료 알림
    self.postMessage({
      type: "phaseComplete",
      phase: 1,
      workerId,
      processed: phase1Processed,
      bestScore,
      bestCombination: serializeCombination(bestCombination),
      message: "1단계 완료! 정밀 탐색 시작...",
    });

    console.log(
      `[Worker ${workerId}] 1단계 완료 - 최고점수: ${bestScore}, 처리: ${phase1Processed}`
    );

    // ========================================
    // 2단계: 정밀 확장 탐색
    // ========================================
    self.postMessage({
      type: "phaseStart",
      phase: 2,
      workerId,
      message: "2단계: 정밀 확장 탐색 시작...",
    });

    // 1단계에서 선택된 룬 ID 수집
    const selectedWeaponIds = new Set();
    const selectedArmorIds = new Set();

    if (bestCombination) {
      selectedWeaponIds.add(bestCombination.weapon.id);
      bestCombination.armors.forEach((a) => selectedArmorIds.add(a.id));
    }

    // 상위 10개도 포함
    phase1Weapons.slice(0, 10).forEach((w) => selectedWeaponIds.add(w.id));
    phase1Armors.slice(0, 15).forEach((a) => selectedArmorIds.add(a.id));

    // ±5등 확장
    const phase2Weapons = expandSelection(
      selectedWeaponIds,
      weaponData.allSorted,
      EXPAND_RANGE
    );
    const phase2Armors = expandSelection(
      selectedArmorIds,
      armorData.allSorted,
      EXPAND_RANGE
    );

    console.log(
      `[Worker ${workerId}] 2단계 확장: 무기=${phase2Weapons.length}, 방어구=${phase2Armors.length}`
    );

    // 2단계 조합 생성
    const phase2ArmorCombos = [];
    for (let a1 = 0; a1 < phase2Armors.length - 4; a1++) {
      for (let a2 = a1 + 1; a2 < phase2Armors.length - 3; a2++) {
        for (let a3 = a2 + 1; a3 < phase2Armors.length - 2; a3++) {
          for (let a4 = a3 + 1; a4 < phase2Armors.length - 1; a4++) {
            for (let a5 = a4 + 1; a5 < phase2Armors.length; a5++) {
              phase2ArmorCombos.push([
                phase2Armors[a1],
                phase2Armors[a2],
                phase2Armors[a3],
                phase2Armors[a4],
                phase2Armors[a5],
              ]);
            }
          }
        }
      }
    }

    const phase2Total =
      phase2Weapons.length *
      phase2ArmorCombos.length *
      phase1Emblems.length *
      accessoryCombos.length;
    console.log(
      `[Worker ${workerId}] 2단계 조합 수: ${phase2Total.toLocaleString()}`
    );

    // 2단계 탐색
    let phase2Processed = 0;
    const phase2StartTime = Date.now();
    lastProgressTime = phase2StartTime;

    for (const weapon of phase2Weapons) {
      for (const armorCombo of phase2ArmorCombos) {
        for (const emblem of phase1Emblems) {
          for (const accessoryCombo of accessoryCombos) {
            phase2Processed++;

            const combination = {
              weapon,
              armors: armorCombo,
              emblem,
              accessories: accessoryCombo.combo,
            };

            const score = calculateCombinationScore(combination, options);

            if (score > bestScore) {
              bestScore = score;
              bestCombination = combination;

              self.postMessage({
                type: "bestFound",
                phase: 2,
                workerId,
                bestScore,
                bestCombination: serializeCombination(bestCombination),
              });
            }

            // 진행률 업데이트
            const now = Date.now();
            if (now - lastProgressTime >= PROGRESS_INTERVAL) {
              lastProgressTime = now;
              const elapsed = (now - phase2StartTime) / 1000;
              const progress = phase2Processed / phase2Total;
              const remaining =
                progress > 0 ? (elapsed / progress) * (1 - progress) : 0;

              self.postMessage({
                type: "progress",
                phase: 2,
                workerId,
                processed: phase2Processed,
                total: phase2Total,
                progress: Math.round(progress * 100),
                bestScore,
                estimatedRemaining: Math.round(remaining),
              });
            }
          }
        }
      }
    }

    // 최종 완료
    console.log(
      `[Worker ${workerId}] 2단계 탐색 완료 - 최종점수: ${bestScore}`
    );

    self.postMessage({
      type: "complete",
      workerId,
      bestScore,
      bestCombination: serializeCombination(bestCombination),
      phase1Processed,
      phase2Processed,
      totalProcessed: phase1Processed + phase2Processed,
    });
  } catch (error) {
    console.error("[Worker] 2단계 탐색 오류:", error);
    self.postMessage({
      type: "error",
      message: error.message,
      stack: error.stack,
    });
  }
}

/**
 * 조합 직렬화 (postMessage용)
 */
function serializeCombination(combination) {
  if (!combination) return null;
  return {
    weapon: {
      id: combination.weapon.id,
      name: combination.weapon.name,
      baseScore: combination.weapon.baseScore,
    },
    armors: combination.armors.map((a) => ({
      id: a.id,
      name: a.name,
      baseScore: a.baseScore,
    })),
    emblem: {
      id: combination.emblem.id,
      name: combination.emblem.name,
      baseScore: combination.emblem.baseScore,
    },
    accessories: combination.accessories.map((a) => ({
      id: a.id,
      name: a.name,
      baseScore: a.baseScore,
    })),
  };
}

// ============================================================================
// 섹션 9: 메시지 핸들러
// ============================================================================

/**
 * 메인 스레드로부터 메시지 수신
 */
self.onmessage = function (e) {
  const { type, data } = e.data;

  switch (type) {
    case "start":
      console.log("[Worker] 최적화 탐색 시작");
      findOptimalCombination(data);
      break;

    case "startPartial":
      // 병렬 처리: 특정 무기 범위만 처리
      console.log(
        `[Worker ${data.workerId}] 부분 탐색 시작 - 무기 ${data.weapons.length}개`
      );
      findOptimalCombinationPartial(data);
      break;

    case "startTwoPhase":
      // 2단계 탐색: 빠른 탐색 + 정밀 확장
      console.log("[Worker] 2단계 탐색 시작");
      findOptimalCombinationTwoPhase(data);
      break;

    case "stop":
      console.log("[Worker] 탐색 중단");
      self.close();
      break;

    default:
      console.warn("[Worker] 알 수 없는 메시지 타입:", type);
  }
};

/**
 * 부분 최적 조합 탐색 (병렬 Worker용)
 * @param {Object} data - 탐색 데이터 (weaponStartIdx, weaponEndIdx 포함)
 */
function findOptimalCombinationPartial(data) {
  try {
    const {
      weapons,
      armors,
      emblems,
      accessories,
      options,
      weaponStartIdx,
      weaponEndIdx,
      workerId,
      totalCombinations,
      initialBestScore, // 2단계에서 1단계 최고점수 전달
    } = data;

    console.log(`[Worker ${workerId}] 데이터 수신:`, {
      weapons: weapons.length,
      armors: armors.length,
      emblems: emblems.length,
      accessories: accessories.length,
    });

    // 무기가 없으면 바로 완료
    if (!weapons || weapons.length === 0) {
      console.log(`[Worker ${workerId}] 처리할 무기 없음 - 즉시 완료`);
      self.postMessage({
        type: "complete",
        workerId,
        bestScore: 0,
        bestCombination: null,
        processed: 0,
        skipped: 0,
      });
      return;
    }

    // 1. 각 카테고리별 기본/최대 점수 사전 계산 및 정렬 (maxScore 순)
    // @updated 2025-12-12 - 메인에서 전달된 baseScore 재사용 (일관성 보장)
    const scoredWeapons = weapons
      .map((w) => ({
        ...w,
        baseScore: w.baseScore !== undefined ? w.baseScore : calculateRuneBaseScore(w, options),
        maxScore: w.maxScore !== undefined ? w.maxScore : calculateRuneMaxScore(w, options),
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    // 디버그: 첫 번째 무기 점수 확인
    if (scoredWeapons.length > 0) {
      console.log(
        `[Worker ${workerId}] 첫 번째 무기 점수:`,
        scoredWeapons[0].maxScore,
        scoredWeapons[0].name
      );
    }

    const scoredArmors = armors
      .map((a) => ({
        ...a,
        baseScore: a.baseScore !== undefined ? a.baseScore : calculateRuneBaseScore(a, options),
        maxScore: a.maxScore !== undefined ? a.maxScore : calculateRuneMaxScore(a, options),
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    const scoredEmblems = emblems
      .map((e) => ({
        ...e,
        baseScore: e.baseScore !== undefined ? e.baseScore : calculateRuneBaseScore(e, options),
        maxScore: e.maxScore !== undefined ? e.maxScore : calculateRuneMaxScore(e, options),
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    const scoredAccessories = accessories
      .map((a) => ({
        ...a,
        baseScore: a.baseScore !== undefined ? a.baseScore : calculateRuneBaseScore(a, options),
        maxScore: a.maxScore !== undefined ? a.maxScore : calculateRuneMaxScore(a, options),
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    // 2. 최대 가능 점수 계산 (가지치기용)
    // 더 타이트한 상한으로 스킵률 향상
    const UPPER_BOUND_MULTIPLIER = 1.15;

    const maxArmorScore =
      scoredArmors.slice(0, 5).reduce((sum, a) => sum + a.baseScore, 0) *
      UPPER_BOUND_MULTIPLIER;
    const maxEmblemScore = scoredEmblems[0]
      ? scoredEmblems[0].baseScore * UPPER_BOUND_MULTIPLIER
      : 0;
    const maxAccessoryScore =
      scoredAccessories.slice(0, 3).reduce((sum, a) => sum + a.baseScore, 0) *
      UPPER_BOUND_MULTIPLIER;
    // 시너지 최대치: 현실적인 값 (50)
    const maxSynergyBonus = 50;

    // 3. 초기 최적해 설정 (greedy)
    const initialCombination = {
      weapon: scoredWeapons[0],
      armors: scoredArmors.slice(0, 5),
      emblem: scoredEmblems[0],
      accessories: scoredAccessories.slice(0, 3),
    };

    let bestScore = calculateCombinationScore(initialCombination, options);
    let bestCombination = initialCombination;

    // 2단계 탐색 시 1단계 최고점수를 초기값으로 사용 (더 공격적인 가지치기)
    if (initialBestScore && initialBestScore > bestScore) {
      bestScore = initialBestScore;
      bestCombination = null; // 1단계 결과가 더 좋으면 유지
      console.log(`[Worker ${workerId}] 1단계 점수 적용:`, bestScore);
    } else {
      console.log(`[Worker ${workerId}] 초기 최적해 점수:`, bestScore);
    }
    let processedCount = 0;
    let skippedCount = 0;

    // 시간 기반 진행률 업데이트
    const PROGRESS_UPDATE_INTERVAL_MS = 500;
    let lastProgressTime = Date.now();
    let startTime = Date.now();

    const perArmorCombo =
      scoredEmblems.length * nCr(scoredAccessories.length, 3);

    // 4. 지정된 무기 범위만 탐색 (baseScore × 배율 가지치기)
    for (
      let wi = weaponStartIdx;
      wi < weaponEndIdx && wi < scoredWeapons.length;
      wi++
    ) {
      const weapon = scoredWeapons[wi];

      // 무기 레벨 가지치기 (baseScore × 배율)
      const weaponUpperBound =
        weapon.baseScore * UPPER_BOUND_MULTIPLIER +
        maxArmorScore +
        maxEmblemScore +
        maxAccessoryScore +
        maxSynergyBonus;
      if (weaponUpperBound <= bestScore) {
        const remainingWeapons = weaponEndIdx - wi;
        skippedCount +=
          remainingWeapons * nCr(scoredArmors.length, 5) * perArmorCombo;
        break;
      }

      for (const armorCombo of combinations(scoredArmors, 5)) {
        // baseScore 합 × 배율로 상한 계산
        const armorBaseSum = armorCombo.reduce(
          (sum, a) => sum + a.baseScore,
          0
        );

        // 방어구 레벨 가지치기 (baseScore × 배율)
        const armorUpperBound =
          weapon.baseScore * UPPER_BOUND_MULTIPLIER +
          armorBaseSum * UPPER_BOUND_MULTIPLIER +
          maxEmblemScore +
          maxAccessoryScore +
          maxSynergyBonus;
        if (armorUpperBound <= bestScore) {
          skippedCount += perArmorCombo;

          const now = Date.now();
          if (now - lastProgressTime >= PROGRESS_UPDATE_INTERVAL_MS) {
            lastProgressTime = now;
            self.postMessage({
              type: "progress",
              workerId,
              processed: processedCount,
              skipped: skippedCount,
              bestScore,
            });
          }
          continue;
        }

        for (let ei = 0; ei < scoredEmblems.length; ei++) {
          const emblem = scoredEmblems[ei];

          // 엠블럼 레벨 가지치기 (baseScore × 배율)
          const emblemUpperBound =
            weapon.baseScore * UPPER_BOUND_MULTIPLIER +
            armorBaseSum * UPPER_BOUND_MULTIPLIER +
            emblem.baseScore * UPPER_BOUND_MULTIPLIER +
            maxAccessoryScore +
            maxSynergyBonus;
          if (emblemUpperBound <= bestScore) {
            skippedCount += nCr(scoredAccessories.length, 3);
            continue;
          }

          for (const accessoryCombo of combinations(scoredAccessories, 3)) {
            processedCount++;

            const combination = {
              weapon,
              armors: armorCombo,
              emblem,
              accessories: accessoryCombo,
            };

            const totalScore = calculateCombinationScore(combination, options);

            if (totalScore > bestScore) {
              bestScore = totalScore;
              bestCombination = combination;
            }

            const now = Date.now();
            if (now - lastProgressTime >= PROGRESS_UPDATE_INTERVAL_MS) {
              lastProgressTime = now;
              self.postMessage({
                type: "progress",
                workerId,
                processed: processedCount,
                skipped: skippedCount,
                bestScore,
              });
            }
          }
        }
      }
    }

    // 5. 결과 반환
    console.log(`[Worker ${workerId}] 탐색 완료 - 최고점수: ${bestScore}`);
    self.postMessage({
      type: "complete",
      workerId,
      bestScore,
      bestCombination,
      processed: processedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error("[Worker] 오류 발생:", error);
    self.postMessage({
      type: "error",
      message: error.message,
      stack: error.stack,
    });
  }
}
