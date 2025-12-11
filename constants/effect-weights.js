/**
 * ============================================================================
 * 마비노기 모바일 룬 효율 계산기 - 효과 가중치 상수
 * ============================================================================
 * @file effect-weights.js
 * @description 룬 효과별 가중치 및 유형별 가중치 정의
 * @author AI Assistant
 * @created 2025-12-11
 * 
 * @architecture
 * - EFFECT_WEIGHTS: DPS 관련 효과별 기본 가중치
 * - TYPE_WEIGHTS: 효과 유형별 가중치 (상시, 트리거, 중첩 등)
 * - DEMERIT_WEIGHTS: 결함 효과별 가중치
 * - SYNERGY_WEIGHTS: 시너지 효과별 가중치
 * ============================================================================
 */

'use strict';

// ============================================================================
// 섹션 1: DPS 직접 효과 가중치
// ============================================================================

/**
 * DPS에 직접 기여하는 효과별 가중치
 * 기준: 공격력 증가 = 1.0
 * 
 * @constant {Object}
 */
const EFFECT_WEIGHTS = Object.freeze({
  // ========== 핵심 DPS 효과 (가중치 1.0) ==========
  /** 공격력 증가 (%) - 최종 곱연산, 기준값 */
  ATTACK_INCREASE: 1.0,
  
  /** 피해량 증가 (%) - 스킬 위력에 합연산 */
  DAMAGE_INCREASE: 1.0,
  
  // ========== 치명타 관련 (가중치 0.6~0.7) ==========
  /** 치명타 확률 증가 (%) - 한계효용 감소, 캡 50% */
  CRIT_RATE: 0.7,
  
  /** 치명타 피해량 증가 (%) - 확률 의존적 */
  CRIT_DAMAGE: 0.6,
  
  // ========== 추가타/연타/강타 관련 (가중치 0.5~0.7) ==========
  /** 추가타 확률 증가 (%) - 13000 스텟당 100% */
  ADDITIONAL_HIT_RATE: 0.7,
  
  /** 추가타 피해량 증가 (%) */
  ADDITIONAL_HIT_DAMAGE: 0.5,
  
  /** 연타 피해 증가 (%) - 3초 내 6회 공격 조건 */
  COMBO_HIT_DAMAGE: 0.6,
  
  /** 강타 피해 증가 (%) - 8500 스텟당 100%, 곱연산 */
  HEAVY_HIT_DAMAGE: 0.6,
  
  // ========== 스킬/콤보/광역 관련 (가중치 0.4~0.7) ==========
  /** 스킬 피해 증가 (%) - 스킬 위력에 곱연산 */
  SKILL_DAMAGE: 0.7,
  
  /** 콤보 피해 증가 (%) - 어시스트 해제 필요 */
  COMBO_DAMAGE: 0.4,
  
  /** 멀티히트 피해 증가 (%) - 클래스별 상이 */
  MULTI_HIT_DAMAGE: 0.4,
  
  /** 광역 피해 증가 (%) - 다수 타격 시에만 */
  AOE_DAMAGE: 0.4,
  
  // ========== 속도 관련 (간접 DPS 기여) ==========
  /** 쿨타임 회복 속도 증가 (%) - 스킬 사용 빈도 증가 */
  COOLDOWN_RECOVERY: 0.7,
  
  /** 스킬 사용 속도 증가 (%) - 시전 시간 단축 */
  SKILL_SPEED: 0.5,
  
  /** 캐스팅/차지 속도 증가 (%) - 캐스팅 스킬 한정 */
  CASTING_SPEED: 0.5,
  
  /** 공격 속도 증가 (%) - 기본 공격 위주, DPS 기여 낮음 */
  ATTACK_SPEED: 0.3,
  
  /** 이동 속도 증가 (%) - DPS 거의 무관 */
  MOVE_SPEED: 0.1
});

// ============================================================================
// 섹션 2: 효과 유형별 가중치
// ============================================================================

/**
 * 효과 발동 유형별 가중치
 * 
 * @constant {Object}
 */
const TYPE_WEIGHTS = Object.freeze({
  /** 상시 적용 효과 */
  PERMANENT: 1.0,
  
  /** 중첩/축적 효과 - 최대 중첩 기준, 쉽게 유지 */
  STACKING: 0.95,
  
  /** 트리거 조건 효과 - 조건 발동 */
  TRIGGER: 0.8,
  
  /** 상태 조건 효과 - HP/자원 조건 */
  STATE: 0.7,
  
  /** 지속 시간 효과 - 업타임 계산 필요 */
  DURATION: 0.0, // 동적 계산 (uptime)
  
  /** 시간 감소 효과 - 평균값 계산 필요 */
  DECAY: 0.0, // 동적 계산 (averageValue)
  
  /** 각성 효과 - 업타임 계산 필요 */
  AWAKENING: 0.0, // 동적 계산 (awakeningUptime)
  
  /** 스킬 변경 효과 - DPS 수치화 어려움 */
  SKILL_CHANGE: 0.0
});

// ============================================================================
// 섹션 3: 결함 효과 가중치
// ============================================================================

/**
 * 결함(디메릿) 효과별 가중치
 * 결함 점수 = 결함값 × 결함 가중치
 * 
 * @constant {Object}
 */
const DEMERIT_WEIGHTS = Object.freeze({
  /** 피해량 감소 - 직접 DPS 감소 */
  DAMAGE_DECREASE: 1.0,
  
  /** 멀티히트 피해 감소 - 클래스별 영향도 상이 */
  MULTI_HIT_DECREASE: 0.8,
  
  /** 쿨타임 회복 속도 감소 - 스킬 사용 빈도 감소 */
  COOLDOWN_DECREASE: 0.7,
  
  /** 치명타 확률 감소 */
  CRIT_RATE_DECREASE: 0.6,
  
  /** 스킬 사용 속도 감소 */
  SKILL_SPEED_DECREASE: 0.5,
  
  /** 캐스팅/차지 속도 감소 */
  CASTING_SPEED_DECREASE: 0.5,
  
  /** 받는 피해 증가 - 생존 관련 */
  DAMAGE_TAKEN_INCREASE: 0.2,
  
  /** 이동 속도 감소 - DPS 거의 무관 */
  MOVE_SPEED_DECREASE: 0.1
});

// ============================================================================
// 섹션 4: 시너지 효과 가중치
// ============================================================================

/**
 * 시너지 효과별 가중치
 * 
 * @constant {Object}
 */
const SYNERGY_WEIGHTS = Object.freeze({
  /** 결함 제거 시너지 (영원 룬) - 결함 점수 전액 복구 */
  DEMERIT_REMOVAL: 1.0,
  
  /** 각성 쿨타임 감소 시너지 (눈 먼 예언자) */
  AWAKENING_COOLDOWN: 0.9,
  
  /** DoT 부여 → 조건 효과 시너지 */
  DOT_SYNERGY: 0.8,
  
  /** 각성 2배 효과 시너지 (압도적인힘/섬세한손놀림) */
  AWAKENING_DOUBLE: 0.8,
  
  /** 중첩 보너스 시너지 (쌍둥이별/에메랄드숲) */
  STACKING_BONUS: 0.7
});

// ============================================================================
// 섹션 5: 효과명 → 가중치 키 매핑
// ============================================================================

/**
 * 룬 효과 텍스트에서 가중치 키로 매핑
 * 
 * @constant {Object}
 */
const EFFECT_NAME_MAP = Object.freeze({
  // 공격력/피해량
  '공격력': 'ATTACK_INCREASE',
  '공격력 증가': 'ATTACK_INCREASE',
  '피해량': 'DAMAGE_INCREASE',
  '피해량 증가': 'DAMAGE_INCREASE',
  '주는 피해': 'DAMAGE_INCREASE',
  '적에게 주는 피해': 'DAMAGE_INCREASE',
  
  // 치명타
  '치명타 확률': 'CRIT_RATE',
  '치명타': 'CRIT_RATE',
  '치명타 피해': 'CRIT_DAMAGE',
  '치명타 피해량': 'CRIT_DAMAGE',
  
  // 추가타/연타/강타
  '추가타 확률': 'ADDITIONAL_HIT_RATE',
  '추가타': 'ADDITIONAL_HIT_RATE',
  '추가타 피해': 'ADDITIONAL_HIT_DAMAGE',
  '추가타 피해량': 'ADDITIONAL_HIT_DAMAGE',
  '연타 피해': 'COMBO_HIT_DAMAGE',
  '연타 피해량': 'COMBO_HIT_DAMAGE',
  '강타 피해': 'HEAVY_HIT_DAMAGE',
  '강타 피해량': 'HEAVY_HIT_DAMAGE',
  
  // 스킬/콤보/광역
  '스킬 피해': 'SKILL_DAMAGE',
  '스킬 피해량': 'SKILL_DAMAGE',
  '콤보 피해': 'COMBO_DAMAGE',
  '콤보 피해량': 'COMBO_DAMAGE',
  '멀티히트 피해': 'MULTI_HIT_DAMAGE',
  '멀티히트 피해량': 'MULTI_HIT_DAMAGE',
  '광역 피해': 'AOE_DAMAGE',
  '광역 피해량': 'AOE_DAMAGE',
  
  // 속도
  '쿨타임 회복 속도': 'COOLDOWN_RECOVERY',
  '재사용 대기시간 회복 속도': 'COOLDOWN_RECOVERY',
  '스킬 사용 속도': 'SKILL_SPEED',
  '캐스팅 속도': 'CASTING_SPEED',
  '차지 속도': 'CASTING_SPEED',
  '공격 속도': 'ATTACK_SPEED',
  '이동 속도': 'MOVE_SPEED'
});

/**
 * 결함 효과 텍스트에서 가중치 키로 매핑
 * 
 * @constant {Object}
 */
const DEMERIT_NAME_MAP = Object.freeze({
  '피해량 감소': 'DAMAGE_DECREASE',
  '주는 피해 감소': 'DAMAGE_DECREASE',
  '멀티히트 피해 감소': 'MULTI_HIT_DECREASE',
  '쿨타임 회복 속도 감소': 'COOLDOWN_DECREASE',
  '재사용 대기시간 회복 속도 감소': 'COOLDOWN_DECREASE',
  '치명타 확률 감소': 'CRIT_RATE_DECREASE',
  '스킬 사용 속도 감소': 'SKILL_SPEED_DECREASE',
  '캐스팅 속도 감소': 'CASTING_SPEED_DECREASE',
  '차지 속도 감소': 'CASTING_SPEED_DECREASE',
  '받는 피해 증가': 'DAMAGE_TAKEN_INCREASE',
  '이동 속도 감소': 'MOVE_SPEED_DECREASE'
});

// ============================================================================
// 섹션 6: 헬퍼 함수
// ============================================================================

/**
 * 효과명으로 가중치 조회
 * 
 * @param {string} effectName - 효과명
 * @returns {number} 가중치 (0~1)
 * 
 * @example
 * const weight = getEffectWeight('공격력 증가');
 * // 1.0
 */
function getEffectWeight(effectName) {
  const key = EFFECT_NAME_MAP[effectName];
  if (key && EFFECT_WEIGHTS[key] !== undefined) {
    return EFFECT_WEIGHTS[key];
  }
  return 0; // 매핑되지 않은 효과는 0
}

/**
 * 결함명으로 가중치 조회
 * 
 * @param {string} demeritName - 결함명
 * @returns {number} 가중치 (0~1)
 */
function getDemeritWeight(demeritName) {
  const key = DEMERIT_NAME_MAP[demeritName];
  if (key && DEMERIT_WEIGHTS[key] !== undefined) {
    return DEMERIT_WEIGHTS[key];
  }
  return 0;
}

/**
 * 효과 유형으로 가중치 조회
 * 
 * @param {string} typeName - 유형명 (PERMANENT, TRIGGER, STACKING 등)
 * @returns {number} 가중치 (0~1)
 */
function getTypeWeight(typeName) {
  return TYPE_WEIGHTS[typeName] !== undefined ? TYPE_WEIGHTS[typeName] : 0;
}

/**
 * 시너지 유형으로 가중치 조회
 * 
 * @param {string} synergyType - 시너지 유형명
 * @returns {number} 가중치 (0~1)
 */
function getSynergyWeight(synergyType) {
  return SYNERGY_WEIGHTS[synergyType] !== undefined ? SYNERGY_WEIGHTS[synergyType] : 0;
}

// ============================================================================
// 섹션 7: 모듈 내보내기
// ============================================================================

// ES6 모듈 환경
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EFFECT_WEIGHTS,
    TYPE_WEIGHTS,
    DEMERIT_WEIGHTS,
    SYNERGY_WEIGHTS,
    EFFECT_NAME_MAP,
    DEMERIT_NAME_MAP,
    getEffectWeight,
    getDemeritWeight,
    getTypeWeight,
    getSynergyWeight
  };
}

// 브라우저 환경 - 전역 객체에 등록
if (typeof window !== 'undefined') {
  window.EffectWeights = {
    EFFECT_WEIGHTS,
    TYPE_WEIGHTS,
    DEMERIT_WEIGHTS,
    SYNERGY_WEIGHTS,
    EFFECT_NAME_MAP,
    DEMERIT_NAME_MAP,
    getEffectWeight,
    getDemeritWeight,
    getTypeWeight,
    getSynergyWeight
  };
}

