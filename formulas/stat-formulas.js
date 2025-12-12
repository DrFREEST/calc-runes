/**
 * ============================================================================
 * 마비노기 모바일 룬 효율 계산기 - 능력치 계산 공식
 * ============================================================================
 * @file stat-formulas.js
 * @description 게임 내 능력치 계산 공식 (나무위키 참조)
 * @author AI Assistant
 * @created 2025-12-11
 * @source https://namu.wiki/w/마비노기 모바일/능력치
 * 
 * @architecture
 * - StatFormulas: 각 능력치별 계산 공식
 * - 모든 공식은 게임 내 실제 공식 기반
 * ============================================================================
 */

'use strict';

// ============================================================================
// 섹션 1: 상수 정의
// ============================================================================

/**
 * 계산에 사용되는 기본 상수
 * 
 * @constant {Object}
 */
const FORMULA_CONSTANTS = Object.freeze({
  /** 치명타 확률 계산 상수 */
  CRIT_RATE_BASE: 0.5,
  CRIT_RATE_DIVISOR: 2000,
  CRIT_RATE_OFFSET: 1000,
  CRIT_RATE_CAP: 0.5, // 50% 캡
  
  /** 치명타 피해량 계산 상수 */
  CRIT_DAMAGE_BASE: 1.4,
  CRIT_DAMAGE_DIVISOR: 5000,
  
  /** 추가타 확률 계산 상수 */
  ADDITIONAL_HIT_DIVISOR: 13000,
  
  /** 강타/연타/광역 강화 계산 상수 */
  HEAVY_HIT_DIVISOR: 8500,
  COMBO_HIT_DIVISOR: 8500,
  AOE_DIVISOR: 8500,
  
  /** 콤보 강화 계산 상수 */
  COMBO_DIVISOR: 17500,
  COMBO_BASE: 11,
  
  /** 스킬 위력 계산 상수 */
  SKILL_POWER_DIVISOR: 8500,
  
  /** 궁극기 계산 상수 */
  ULTIMATE_GAUGE_DIVISOR: 7250,
  ULTIMATE_DAMAGE_DIVISOR: 8750,
  
  /** 무방비 계산 상수 */
  BREAK_DIVISOR: 5250,
  
  /** 방어력 계산 상수 */
  DEFENSE_DIVISOR: 10000,
  
  /** 회복력 계산 상수 */
  RECOVERY_DIVISOR: 8750,
  
  /** 각성 기본 쿨타임 (초) */
  AWAKENING_BASE_COOLDOWN: 90,
  
  /** 전투 시간 기준 (초) - 레이드/어비스 보스 */
  COMBAT_DURATION: 120
});

// ============================================================================
// 섹션 2: 치명타 관련 공식
// ============================================================================

/**
 * 치명타 확률 계산
 * 공식: min(0.5 - 1000/(치명타+2000), 0.5) + K₁
 * 
 * @description
 * - 스텟 기반 기본 확률: 최대 50% 캡
 * - 룬 효과(K₁): 기본 확률에 가산, 최종 100%까지 가능
 * - 권장 전투력 이상(K₃): +30% 추가
 * 
 * @param {number} critStat - 치명타 스텟 수치
 * @param {number} [critRateBonus=0] - 치명타 확률 % 증가 합계 (K₁, 룬 효과)
 * @param {number} [gustingBoltCount=0] - 석궁사수 거스팅 볼트 발사 횟수 (K₂)
 * @param {boolean} [isOverPower=false] - 권장 전투력 이상 여부 (K₃)
 * @returns {number} 치명타 확률 (0~1)
 * 
 * @example
 * // 스텟 6000, 룬 보너스 18%
 * const critRate = calculateCritRate(6000, 18);
 * // 약 0.555 (55.5%) - 기본 37.5% + 룬 18%
 */
function calculateCritRate(critStat, critRateBonus = 0, gustingBoltCount = 0, isOverPower = false) {
  const { CRIT_RATE_BASE, CRIT_RATE_DIVISOR, CRIT_RATE_OFFSET, CRIT_RATE_CAP } = FORMULA_CONSTANTS;
  
  // 스텟 기반 기본 확률 (50% 캡)
  let baseRate = CRIT_RATE_BASE - (CRIT_RATE_OFFSET / (critStat + CRIT_RATE_DIVISOR));
  baseRate = Math.min(baseRate, CRIT_RATE_CAP); // 스텟 기반은 50% 캡
  
  // 치명타 확률 % 보너스 추가 (K₁) - 100%까지 가산 가능
  let totalRate = baseRate + (critRateBonus / 100);
  
  // 석궁사수 거스팅 볼트 감소 적용 (K₂)
  if (gustingBoltCount > 0) {
    totalRate *= Math.pow(0.75, gustingBoltCount);
  }
  
  // 권장 전투력 이상 시 30% 추가 (K₃)
  if (isOverPower) {
    totalRate += 0.3;
  }
  
  // 최종 캡 적용 (100%)
  return Math.min(totalRate, 1.0);
}

/**
 * 치명타 피해량 배율 계산
 * 공식: (1.4 + 치명타/5000) * (1+K₄)
 * 
 * @param {number} critStat - 치명타 스텟 수치
 * @param {number} [critDamageBonus=0] - 치명타 피해량 % 증가 합계 (K₄)
 * @returns {number} 치명타 피해량 배율
 * 
 * @example
 * const critDamage = calculateCritDamage(6000, 50);
 * // 약 3.9 (390%)
 */
function calculateCritDamage(critStat, critDamageBonus = 0) {
  const { CRIT_DAMAGE_BASE, CRIT_DAMAGE_DIVISOR } = FORMULA_CONSTANTS;
  
  const baseDamage = CRIT_DAMAGE_BASE + (critStat / CRIT_DAMAGE_DIVISOR);
  return baseDamage * (1 + critDamageBonus / 100);
}

// ============================================================================
// 섹션 3: 추가타/연타/강타/콤보/광역 공식
// ============================================================================

/**
 * 추가타 확률 계산
 * 공식: (추가타/13000) + L₁
 * 
 * @param {number} additionalHitStat - 추가타 스텟 수치
 * @param {number} [additionalHitBonus=0] - 추가타 확률 % 증가 합계 (L₁)
 * @returns {number} 추가타 확률 (0~1)
 */
function calculateAdditionalHitRate(additionalHitStat, additionalHitBonus = 0) {
  const { ADDITIONAL_HIT_DIVISOR } = FORMULA_CONSTANTS;
  
  return (additionalHitStat / ADDITIONAL_HIT_DIVISOR) + (additionalHitBonus / 100);
}

/**
 * 강타 피해 증가 배율 계산
 * 공식: ((1+강타 강화/8500) * (1+C₁)) - 1
 * 
 * @param {number} heavyHitStat - 강타 강화 스텟 수치
 * @param {number} [heavyHitBonus=0] - 강타 피해 % 증가 합계 (C₁)
 * @returns {number} 강타 피해 증가 배율 (0 = 증가 없음)
 */
function calculateHeavyHitDamage(heavyHitStat, heavyHitBonus = 0) {
  const { HEAVY_HIT_DIVISOR } = FORMULA_CONSTANTS;
  
  return ((1 + heavyHitStat / HEAVY_HIT_DIVISOR) * (1 + heavyHitBonus / 100)) - 1;
}

/**
 * 연타 피해 증가 배율 계산
 * 공식: ((1+ 연타 강화/8500) * (1+F₁)) - 1
 * 
 * @param {number} comboHitStat - 연타 강화 스텟 수치
 * @param {number} [comboHitBonus=0] - 연타 피해 % 증가 합계 (F₁)
 * @returns {number} 연타 피해 증가 배율
 */
function calculateComboHitDamage(comboHitStat, comboHitBonus = 0) {
  const { COMBO_HIT_DIVISOR } = FORMULA_CONSTANTS;
  
  return ((1 + comboHitStat / COMBO_HIT_DIVISOR) * (1 + comboHitBonus / 100)) - 1;
}

/**
 * 콤보 피해 증가 배율 계산
 * 공식: ((11+콤보 강화/17500) * (1+E₁) - 1) * (E₂/4)
 * 
 * @param {number} comboStat - 콤보 강화 스텟 수치
 * @param {number} [comboBonus=0] - 콤보 피해 % 증가 합계 (E₁)
 * @param {number} [comboCount=100] - 현재 콤보 수
 * @returns {number} 콤보 피해 증가 배율
 */
function calculateComboDamage(comboStat, comboBonus = 0, comboCount = 100) {
  const { COMBO_DIVISOR, COMBO_BASE } = FORMULA_CONSTANTS;
  
  // E₂: 콤보 구간별 계수
  let comboMultiplier;
  if (comboCount <= 10) {
    comboMultiplier = 1;
  } else if (comboCount <= 50) {
    comboMultiplier = 2;
  } else if (comboCount <= 100) {
    comboMultiplier = 3;
  } else {
    comboMultiplier = 4;
  }
  
  return ((COMBO_BASE + comboStat / COMBO_DIVISOR) * (1 + comboBonus / 100) - 1) * (comboMultiplier / 4);
}

/**
 * 광역 피해 증가 배율 계산
 * 공식: ((1+광역 강화/8500) * (1+I₁)) - 1
 * 
 * @param {number} aoeStat - 광역 강화 스텟 수치
 * @param {number} [aoeBonus=0] - 광역 피해 % 증가 합계 (I₁)
 * @returns {number} 광역 피해 증가 배율
 */
function calculateAoeDamage(aoeStat, aoeBonus = 0) {
  const { AOE_DIVISOR } = FORMULA_CONSTANTS;
  
  return ((1 + aoeStat / AOE_DIVISOR) * (1 + aoeBonus / 100)) - 1;
}

// ============================================================================
// 섹션 4: 스킬 위력 공식
// ============================================================================

/**
 * 스킬 피해 배율 계산
 * 공식: (((스킬 위력/8500) * (1+G₁)) + G₂ + G₃) * (G₄ + G₅)
 * 
 * @param {number} skillPowerStat - 스킬 위력 스텟 수치
 * @param {Object} bonuses - 각종 보너스
 * @param {number} [bonuses.skillDamageBonus=0] - 스킬 피해 % 증가 (G₁)
 * @param {number} [bonuses.damageBonus=0] - 피해량 % 증가 (G₂)
 * @param {number} [bonuses.synergyDamageBonus=0] - 시너지 피해 % 증가 (G₃)
 * @param {number} [bonuses.enemyDamageTaken=0] - 적 받는 피해 % 증가 (G₄)
 * @param {number} [bonuses.armorBreak=0] - 방어구 파괴 효과 (G₅, 기본 10%)
 * @returns {number} 스킬 피해 배율
 */
function calculateSkillDamage(skillPowerStat, bonuses = {}) {
  const { SKILL_POWER_DIVISOR } = FORMULA_CONSTANTS;
  
  const {
    skillDamageBonus = 0,
    damageBonus = 0,
    synergyDamageBonus = 0,
    enemyDamageTaken = 0,
    armorBreak = 0
  } = bonuses;
  
  const basePart = (skillPowerStat / SKILL_POWER_DIVISOR) * (1 + skillDamageBonus / 100);
  const additivePart = damageBonus / 100 + synergyDamageBonus / 100;
  const enemyPart = 1 + enemyDamageTaken / 100 + armorBreak / 100;
  
  return (basePart + additivePart) * enemyPart;
}

// ============================================================================
// 섹션 5: 궁극기 공식
// ============================================================================

/**
 * 궁극기 게이지 획득 배율 계산
 * 공식: (1 + 궁극기/7250) * (1+O₁)
 * 
 * @param {number} ultimateStat - 궁극기 스텟 수치
 * @param {number} [gaugeBonus=0] - 궁극기 게이지 획득량 % 증가 (O₁)
 * @returns {number} 궁극기 게이지 획득 배율
 */
function calculateUltimateGauge(ultimateStat, gaugeBonus = 0) {
  const { ULTIMATE_GAUGE_DIVISOR } = FORMULA_CONSTANTS;
  
  return (1 + ultimateStat / ULTIMATE_GAUGE_DIVISOR) * (1 + gaugeBonus / 100);
}

/**
 * 궁극기 피해 증가 배율 계산
 * 공식: ((1+ 궁극기/8750) * (1+O₂)) - 1
 * 
 * @param {number} ultimateStat - 궁극기 스텟 수치
 * @param {number} [damageBonus=0] - 궁극기 대미지 % 증가 (O₂)
 * @returns {number} 궁극기 피해 증가 배율
 */
function calculateUltimateDamage(ultimateStat, damageBonus = 0) {
  const { ULTIMATE_DAMAGE_DIVISOR } = FORMULA_CONSTANTS;
  
  return ((1 + ultimateStat / ULTIMATE_DAMAGE_DIVISOR) * (1 + damageBonus / 100)) - 1;
}

// ============================================================================
// 섹션 6: 무방비/방어력/회복력 공식
// ============================================================================

/**
 * 무방비 피해 배율 계산
 * 공식: (1+브레이크/5250) * (1+A₂) + A₃
 * 
 * @param {number} breakStat - 브레이크 스텟 수치
 * @param {number} [breakDamageBonus=0] - 무방비 피해량 % 증가 (A₂)
 * @param {number} [additionalBreakDamage=0] - 브레이크 타입별 추가 피해 합계 (A₃)
 * @returns {number} 무방비 피해 배율
 */
function calculateBreakDamage(breakStat, breakDamageBonus = 0, additionalBreakDamage = 0) {
  const { BREAK_DIVISOR } = FORMULA_CONSTANTS;
  
  return (1 + breakStat / BREAK_DIVISOR) * (1 + breakDamageBonus / 100) + additionalBreakDamage;
}

/**
 * 받는 피해 계산 (방어력 적용)
 * 공식: 몬스터 대미지 / (1+Y방어력/10000) - 피해 감소
 * 
 * @param {number} monsterDamage - 몬스터가 주는 피해
 * @param {number} defenseStat - 방어력 스텟 수치
 * @param {number} [damageReduction=0] - 받는 피해 감소 절대값
 * @returns {number} 실제 받는 피해
 */
function calculateDamageTaken(monsterDamage, defenseStat, damageReduction = 0) {
  const { DEFENSE_DIVISOR } = FORMULA_CONSTANTS;
  
  return (monsterDamage / (1 + defenseStat / DEFENSE_DIVISOR)) - damageReduction;
}

/**
 * 회복량 계산
 * 공식: (회복력/8750 * (1 + n₁)) * n₂ * 공격력
 * 
 * @param {number} recoveryStat - 회복력 스텟 수치
 * @param {number} attackPower - 공격력
 * @param {number} [recoveryBonus=0] - 회복력 % 증가 (n₁)
 * @param {number} [skillCoefficient=1] - 스킬 계수 (n₂)
 * @returns {number} 회복량
 */
function calculateRecovery(recoveryStat, attackPower, recoveryBonus = 0, skillCoefficient = 1) {
  const { RECOVERY_DIVISOR } = FORMULA_CONSTANTS;
  
  return (recoveryStat / RECOVERY_DIVISOR * (1 + recoveryBonus / 100)) * skillCoefficient * attackPower;
}

// ============================================================================
// 섹션 7: 업타임/한계효용 계산
// ============================================================================

/**
 * 각성 효과 업타임 계산
 * 
 * @param {number} duration - 각성 지속 시간 (초)
 * @param {number} [cooldownReduction=0] - 각성 쿨타임 감소 (초)
 * @returns {number} 업타임 (0~1)
 */
function calculateAwakeningUptime(duration, cooldownReduction = 0) {
  const { AWAKENING_BASE_COOLDOWN } = FORMULA_CONSTANTS;
  
  const effectiveCooldown = Math.max(AWAKENING_BASE_COOLDOWN - cooldownReduction, 0);
  return duration / (duration + effectiveCooldown);
}

/**
 * 지속시간/쿨타임 기반 업타임 계산
 * 
 * @param {number} duration - 효과 지속 시간 (초)
 * @param {number} cooldown - 재사용 대기시간 (초)
 * @returns {number} 업타임 (0~1)
 */
function calculateUptime(duration, cooldown) {
  if (cooldown <= 0) return 1;
  return duration / (duration + cooldown);
}

/**
 * 시간 감소 효과의 평균값 계산
 * 예: 30% 증가 후 3초마다 2% 감소
 * 
 * @param {number} initialValue - 초기 효과값 (%)
 * @param {number} decayRate - 감소율 (%/interval)
 * @param {number} decayInterval - 감소 간격 (초)
 * @param {number} [combatDuration] - 전투 시간 (초)
 * @returns {number} 평균 효과값 (%)
 */
function calculateDecayAverage(initialValue, decayRate, decayInterval, combatDuration) {
  const { COMBAT_DURATION } = FORMULA_CONSTANTS;
  const duration = combatDuration || COMBAT_DURATION;
  
  // 효과가 0이 되는 시간
  const zeroTime = (initialValue / decayRate) * decayInterval;
  
  if (zeroTime >= duration) {
    // 전투 시간 내에 0이 되지 않음
    const endValue = initialValue - (decayRate * (duration / decayInterval));
    return (initialValue + endValue) / 2;
  } else {
    // 전투 시간 내에 0이 됨
    const averageDuringEffect = initialValue / 2;
    return (averageDuringEffect * zeroTime) / duration;
  }
}

/**
 * 치명타 확률의 한계효용 계수 계산
 * 현재 확률이 캡에 가까울수록 추가 증가의 가치가 낮아짐
 * 
 * @param {number} currentRate - 현재 치명타 확률 (0~1)
 * @returns {number} 한계효용 계수 (0~1)
 */
function calculateCritMarginalUtility(currentRate) {
  const { CRIT_RATE_CAP } = FORMULA_CONSTANTS;
  
  if (currentRate >= CRIT_RATE_CAP) {
    return 0; // 캡 도달 시 추가 효과 없음
  }
  
  // 캡에 가까울수록 가치 감소 (선형)
  return (CRIT_RATE_CAP - currentRate) / CRIT_RATE_CAP;
}

/**
 * 공격력 % vs 피해량 % 밸런스 효용 계산
 * 곱연산 특성상 둘의 비율이 비슷할수록 효율적
 * 
 * @param {number} attackBonus - 현재 공격력 % 증가 합계
 * @param {number} damageBonus - 현재 피해량 % 증가 합계
 * @returns {Object} { attackMultiplier, damageMultiplier } 각각의 추가 효용 계수
 */
function calculateBonusBalance(attackBonus, damageBonus) {
  const total = attackBonus + damageBonus;
  
  if (total === 0) {
    return { attackMultiplier: 1, damageMultiplier: 1 };
  }
  
  const attackRatio = attackBonus / total;
  const damageRatio = damageBonus / total;
  
  // 비율이 낮은 쪽에 보정 (최대 1.3배)
  // 비율이 높은 쪽은 가치 감소 (최소 0.7배)
  return {
    attackMultiplier: 1 + (0.5 - attackRatio) * 0.6,
    damageMultiplier: 1 + (0.5 - damageRatio) * 0.6
  };
}

// ============================================================================
// 섹션 8: 모듈 내보내기
// ============================================================================

const StatFormulas = {
  // 상수
  FORMULA_CONSTANTS,
  
  // 치명타
  calculateCritRate,
  calculateCritDamage,
  
  // 추가타/연타/강타/콤보/광역
  calculateAdditionalHitRate,
  calculateHeavyHitDamage,
  calculateComboHitDamage,
  calculateComboDamage,
  calculateAoeDamage,
  
  // 스킬 위력
  calculateSkillDamage,
  
  // 궁극기
  calculateUltimateGauge,
  calculateUltimateDamage,
  
  // 무방비/방어력/회복력
  calculateBreakDamage,
  calculateDamageTaken,
  calculateRecovery,
  
  // 업타임/한계효용
  calculateAwakeningUptime,
  calculateUptime,
  calculateDecayAverage,
  calculateCritMarginalUtility,
  calculateBonusBalance
};

// ES6 모듈 환경
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatFormulas;
}

// 브라우저 환경 - 전역 객체에 등록
if (typeof window !== 'undefined') {
  window.StatFormulas = StatFormulas;
}

