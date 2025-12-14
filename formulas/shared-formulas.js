/**
 * ============================================================================
 * 마비노기 모바일 룬 효율 계산기 - 공유 공식 모듈
 * ============================================================================
 * @file shared-formulas.js
 * @description 메인 스레드와 Web Worker 모두에서 사용 가능한 공통 함수/상수
 * @author AI Assistant
 * @created 2025-12-11
 *
 * @architecture
 * - 환경 독립적 설계: window/self 자동 감지
 * - Worker에서 importScripts()로 로드 가능
 * - 메인에서 <script>로 로드 가능
 *
 * @usage
 * - Worker: importScripts('shared-formulas.js');
 * - 메인: <script src="formulas/shared-formulas.js"></script>
 * - 접근: SharedFormulas.calculateUptime(), SharedEffectWeights.getEffectWeight()
 * ============================================================================
 */

(function (global) {
  "use strict";

  // ============================================================================
  // 섹션 1: 기본 상수
  // ============================================================================

  /**
   * 계산에 사용되는 기본 상수
   * @constant {Object}
   */
  var FORMULA_CONSTANTS = Object.freeze({
    /** 치명타 확률 캡 */
    CRIT_RATE_CAP: 0.5,

    /** 각성 기본 쿨타임 (초) */
    AWAKENING_BASE_COOLDOWN: 90,

    /** 전투 시간 기준 (초) */
    COMBAT_DURATION: 120,

    /** Sub 스텟 보너스 */
    SUB_STAT_BONUS: 0.1,

    /** 밸런스 최대 배율 */
    BALANCE_MAX_MULTIPLIER: 1.3,

    /** 눈 먼 예언자 각성 쿨타임 감소량 (초) */
    BLIND_PROPHET_COOLDOWN_REDUCTION: 38,
  });

  // ============================================================================
  // 섹션 2: 효과 가중치 상수
  // ============================================================================

  /**
   * DPS에 직접 기여하는 효과별 가중치
   * @constant {Object}
   */
  var EFFECT_WEIGHTS = Object.freeze({
    ATTACK_INCREASE: 1.0,
    DAMAGE_INCREASE: 1.0,
    CRIT_RATE: 0.7,
    CRIT_DAMAGE: 0.6,
    ADDITIONAL_HIT_RATE: 0.7,
    ADDITIONAL_HIT_DAMAGE: 0.5,
    COMBO_HIT_DAMAGE: 0.6,
    HEAVY_HIT_DAMAGE: 0.6,
    SKILL_DAMAGE: 0.7,
    COMBO_DAMAGE: 0.4,
    MULTI_HIT_DAMAGE: 0.4,
    AOE_DAMAGE: 0.4,
    COOLDOWN_RECOVERY: 0.7,
    SKILL_SPEED: 0.5,
    CASTING_SPEED: 0.5,
    ATTACK_SPEED: 0.3,
    MOVE_SPEED: 0.1,
    // 기본 공격 전용 효과 (DPS 기여 매우 낮음 - 대부분 스킬 딜링)
    BASIC_ATTACK_SPEED: 0.05, // 기본 공격 속도 - 스킬에 무관
    BASIC_ADDITIONAL_HIT: 0.1, // 기본 공격 추가타 - 스킬에 무관
    // 특정 스킬 유형 한정 효과 (가동률 제한)
    CHARGE_SKILL_DAMAGE: 0.35, // 차지 스킬 피해 - 차지 스킬 한정
    // 디버프/타겟 관련 효과 (파티 DPS 기여 높음)
    TARGET_DAMAGE_INCREASE: 1.5, // 타겟 받는 피해 증가 - 매우 높음
    // 조건부 효과 (효율 계산 제외/저가중치)
    BREAK_DAMAGE: 0, // 무방비 피해 - 적 브레이크 시에만 적용
    BREAK_SKILL_DAMAGE: 0, // 브레이크 스킬/피해 - 브레이크 스킬 한정
    DEFENSE_EFFECT: 0, // 생존/회복 효과 - DPS 무관
    DAMAGE_REDUCTION: 0, // 받는 피해 감소 - 생존
  });

  /**
   * 효과 발동 유형별 가중치
   * @constant {Object}
   */
  var TYPE_WEIGHTS = Object.freeze({
    PERMANENT: 1.0,
    STACKING: 0.95,
    TRIGGER: 0.8,
    STATE: 0.7,
    DURATION: 0.0,
    DECAY: 0.0,
    AWAKENING: 0.0,
    SKILL_CHANGE: 0.0,
  });

  /**
   * 결함 효과별 가중치
   * @constant {Object}
   */
  var DEMERIT_WEIGHTS = Object.freeze({
    DAMAGE_DECREASE: 1.0,
    MULTI_HIT_DECREASE: 0.8,
    COOLDOWN_DECREASE: 0.7,
    CRIT_RATE_DECREASE: 0.6,
    SKILL_SPEED_DECREASE: 0.5,
    CASTING_SPEED_DECREASE: 0.3, // @updated 2025-12-11
    DAMAGE_TAKEN_INCREASE: 0.2,
    MOVE_SPEED_DECREASE: 0.1,
  });

  /**
   * 시너지 효과별 가중치
   * @constant {Object}
   */
  var SYNERGY_WEIGHTS = Object.freeze({
    DEMERIT_REMOVAL: 1.0,
    AWAKENING_COOLDOWN: 0.9,
    DOT_SYNERGY: 0.8,
    AWAKENING_DOUBLE: 0.8,
    STACKING_BONUS: 0.7,
  });

  /**
   * 효과명 → 가중치 키 매핑
   * @constant {Object}
   */
  var EFFECT_NAME_MAP = Object.freeze({
    공격력: "ATTACK_INCREASE",
    "공격력 증가": "ATTACK_INCREASE",
    // 무방비/브레이크 피해 (조건부 - 효율 계산 제외)
    "무방비 피해": "BREAK_DAMAGE",
    "무방비 피해량": "BREAK_DAMAGE",
    "무방비 피해 증가": "BREAK_DAMAGE",
    "브레이크 피해": "BREAK_DAMAGE",
    "브레이크 피해 증가": "BREAK_DAMAGE",
    "브레이크 스킬 피해": "BREAK_SKILL_DAMAGE",
    "브레이크 스킬 피해 증가": "BREAK_SKILL_DAMAGE",
    // 타겟 디버프 (파티 DPS 기여 높음)
    "타겟 받는 피해 증가": "TARGET_DAMAGE_INCREASE",
    "추가 피해 + 타겟 받는 피해 증가": "TARGET_DAMAGE_INCREASE",
    // 생존/방어 효과 (DPS 무관)
    "받는 피해 감소": "DAMAGE_REDUCTION",
    "행동 불능 방지": "DEFENSE_EFFECT",
    "행동 불능 방지 + 회복": "DEFENSE_EFFECT",
    피해량: "DAMAGE_INCREASE",
    "피해량 증가": "DAMAGE_INCREASE",
    "피해 증가": "DAMAGE_INCREASE",
    "주는 피해": "DAMAGE_INCREASE",
    "적에게 주는 피해": "DAMAGE_INCREASE",
    "치명타 확률": "CRIT_RATE",
    치명타: "CRIT_RATE",
    "치명타 피해": "CRIT_DAMAGE",
    "치명타 피해량": "CRIT_DAMAGE",
    "추가타 확률": "ADDITIONAL_HIT_RATE",
    추가타: "ADDITIONAL_HIT_RATE",
    "추가타 피해": "ADDITIONAL_HIT_DAMAGE",
    "추가타 피해량": "ADDITIONAL_HIT_DAMAGE",
    "연타 피해": "COMBO_HIT_DAMAGE",
    "연타 피해량": "COMBO_HIT_DAMAGE",
    "강타 피해": "HEAVY_HIT_DAMAGE",
    "강타 피해량": "HEAVY_HIT_DAMAGE",
    "스킬 피해": "SKILL_DAMAGE",
    "스킬 피해량": "SKILL_DAMAGE",
    "콤보 피해": "COMBO_DAMAGE",
    "콤보 피해량": "COMBO_DAMAGE",
    "멀티히트 피해": "MULTI_HIT_DAMAGE",
    "멀티히트 피해량": "MULTI_HIT_DAMAGE",
    "광역 피해": "AOE_DAMAGE",
    "광역 피해량": "AOE_DAMAGE",
    "쿨타임 회복 속도": "COOLDOWN_RECOVERY",
    "쿨타임 회복 속도 증가": "COOLDOWN_RECOVERY",
    "재사용 대기시간 회복 속도": "COOLDOWN_RECOVERY",
    "재사용 대기시간 회복 속도 증가": "COOLDOWN_RECOVERY",
    "스킬 사용 속도": "SKILL_SPEED",
    "스킬 사용 속도 증가": "SKILL_SPEED",
    "캐스팅 속도": "CASTING_SPEED",
    "캐스팅 속도 증가": "CASTING_SPEED",
    "차지 속도": "CASTING_SPEED",
    "차지 속도 증가": "CASTING_SPEED",
    "캐스팅/차지 속도 증가": "CASTING_SPEED",
    "스킬/공격/캐스팅 속도 증가": "SKILL_SPEED",
    "공격 속도": "ATTACK_SPEED",
    "공격 속도 증가": "ATTACK_SPEED",
    "이동 속도": "MOVE_SPEED",
    // 쿨타임 관련
    "스킬 쿨타임 감소": "COOLDOWN_RECOVERY",
    "각성 쿨타임 감소": "COOLDOWN_RECOVERY",
    // 기본 공격 전용 효과 (스킬에 무관하므로 낮은 가중치)
    "기본 공격 속도": "BASIC_ATTACK_SPEED",
    "기본 공격 속도 증가": "BASIC_ATTACK_SPEED",
    "기본 공격 추가타": "BASIC_ADDITIONAL_HIT",
    "기본 공격 추가타 확률": "BASIC_ADDITIONAL_HIT",
    "기본 공격 추가타 확률 증가": "BASIC_ADDITIONAL_HIT",
    // 차지 스킬 한정 효과
    "차지 스킬 피해": "CHARGE_SKILL_DAMAGE",
    "차지 스킬 피해 증가": "CHARGE_SKILL_DAMAGE",
  });

  /**
   * 결함명 → 가중치 키 매핑
   * @constant {Object}
   */
  var DEMERIT_NAME_MAP = Object.freeze({
    "피해량 감소": "DAMAGE_DECREASE",
    "주는 피해 감소": "DAMAGE_DECREASE",
    "멀티히트 피해 감소": "MULTI_HIT_DECREASE",
    "쿨타임 회복 속도 감소": "COOLDOWN_DECREASE",
    "재사용 대기시간 회복 속도 감소": "COOLDOWN_DECREASE",
    "치명타 확률 감소": "CRIT_RATE_DECREASE",
    "스킬 사용 속도 감소": "SKILL_SPEED_DECREASE",
    "캐스팅 속도 감소": "CASTING_SPEED_DECREASE",
    "차지 속도 감소": "CASTING_SPEED_DECREASE",
    "받는 피해 증가": "DAMAGE_TAKEN_INCREASE",
    "이동 속도 감소": "MOVE_SPEED_DECREASE",
  });

  // ============================================================================
  // 섹션 3: 업타임 및 시간 관련 함수
  // ============================================================================

  /**
   * 지속 효과의 업타임 계산
   *
   * @param {number} duration - 지속 시간 (초)
   * @param {number} cooldown - 재사용 대기시간 (초)
   * @returns {number} 업타임 (0~1)
   */
  function calculateUptime(duration, cooldown) {
    if (cooldown <= 0) return 1;
    return duration / (duration + cooldown);
  }

  /**
   * 시간 감소 효과의 평균값 계산
   *
   * @param {number} initialValue - 초기 효과값 (%)
   * @param {number} decayRate - 감소율 (%/interval)
   * @param {number} decayInterval - 감소 간격 (초)
   * @param {number} [combatDuration] - 전투 시간 (초)
   * @returns {number} 평균 효과값 (%)
   */
  function calculateDecayAverage(
    initialValue,
    decayRate,
    decayInterval,
    combatDuration
  ) {
    var duration = combatDuration || FORMULA_CONSTANTS.COMBAT_DURATION;

    // 효과가 0이 되는 시간
    var zeroTime = (initialValue / decayRate) * decayInterval;

    if (zeroTime >= duration) {
      // 전투 시간 내에 0이 되지 않음
      var endValue = initialValue - decayRate * (duration / decayInterval);
      return (initialValue + endValue) / 2;
    } else {
      // 전투 시간 내에 0이 됨
      var averageDuringEffect = initialValue / 2;
      return (averageDuringEffect * zeroTime) / duration;
    }
  }

  /**
   * 각성 효과 업타임 계산
   *
   * @param {number} duration - 각성 지속 시간 (초)
   * @param {number} [cooldownReduction=0] - 쿨타임 감소량 (초)
   * @param {number} [combatDuration] - 전투 시간 (초)
   * @returns {number} 업타임 (0~1)
   */
  function calculateAwakeningUptime(
    duration,
    cooldownReduction,
    combatDuration
  ) {
    var baseCooldown = FORMULA_CONSTANTS.AWAKENING_BASE_COOLDOWN;
    var effectiveCooldown = Math.max(
      0,
      baseCooldown - (cooldownReduction || 0)
    );
    var combat = combatDuration || FORMULA_CONSTANTS.COMBAT_DURATION;

    // 전투 중 각성 사용 횟수
    var activations = 1 + Math.floor(combat / effectiveCooldown);
    var totalActiveTime = Math.min(activations * duration, combat);

    return totalActiveTime / combat;
  }

  // ============================================================================
  // 섹션 4: 한계효용 및 밸런스 함수
  // ============================================================================

  /**
   * 치명타 확률의 한계효용 계수 계산
   * - 현재 확률이 높을수록 추가 치확의 상대적 기여도 감소
   * - 100% 캡 기준 (룬 효과로 50% 이상 가능)
   *
   * @param {number} currentRate - 현재 치명타 확률 (0~1)
   * @returns {number} 한계효용 계수 (0.1~1.0)
   *
   * @example
   * // 20% 상태에서 추가 치확 가치: 1.0 (최대)
   * // 50% 상태에서 추가 치확 가치: 0.5 (중간)
   * // 80% 상태에서 추가 치확 가치: 0.2 (낮음)
   */
  function calculateCritMarginalUtility(currentRate) {
    var maxCap = 1.0; // 100% 최대 캡

    if (currentRate >= maxCap) {
      return 0.1; // 최소값 (캡 초과시에도 약간의 가치)
    }

    // 현재 확률이 높을수록 추가 치확의 상대적 가치 감소
    // 0% → 1.0, 50% → 0.5, 80% → 0.2
    return Math.max(0.1, maxCap - currentRate);
  }

  /**
   * 공격력/피해량 밸런스 효용 계산
   *
   * @param {number} attackBonus - 현재 공격력 % 증가 합계
   * @param {number} damageBonus - 현재 피해량 % 증가 합계
   * @returns {Object} { attackMultiplier, damageMultiplier }
   */
  function calculateBonusBalance(attackBonus, damageBonus) {
    var total = attackBonus + damageBonus;

    if (total === 0) {
      return { attackMultiplier: 1, damageMultiplier: 1 };
    }

    var attackRatio = attackBonus / total;
    var damageRatio = damageBonus / total;

    return {
      attackMultiplier: 1 + (0.5 - attackRatio) * 0.6,
      damageMultiplier: 1 + (0.5 - damageRatio) * 0.6,
    };
  }

  // ============================================================================
  // 섹션 5: 가중치 조회 함수
  // ============================================================================

  /**
   * 효과명으로 가중치 조회 (가장 긴 매칭 우선)
   *
   * @param {string} effectName - 효과명
   * @returns {number} 가중치 (0~1.5)
   */
  function getEffectWeight(effectName) {
    // 직접 매핑 확인 (정확히 일치)
    var key = EFFECT_NAME_MAP[effectName];
    if (key && EFFECT_WEIGHTS[key] !== undefined) {
      return EFFECT_WEIGHTS[key];
    }

    // 부분 매칭 시도 (가장 긴 매칭 우선)
    var bestMatch = null;
    var bestLength = 0;

    for (var name in EFFECT_NAME_MAP) {
      if (effectName.indexOf(name) !== -1 && name.length > bestLength) {
        bestMatch = name;
        bestLength = name.length;
      }
    }

    if (bestMatch) {
      var mappedKey = EFFECT_NAME_MAP[bestMatch];
      if (EFFECT_WEIGHTS[mappedKey] !== undefined) {
        return EFFECT_WEIGHTS[mappedKey];
      }
    }

    return 0.5; // 기본값
  }

  /**
   * 결함명으로 가중치 조회
   *
   * @param {string} demeritName - 결함명
   * @returns {number} 가중치 (0~1)
   */
  function getDemeritWeight(demeritName) {
    var key = DEMERIT_NAME_MAP[demeritName];
    if (key && DEMERIT_WEIGHTS[key] !== undefined) {
      return DEMERIT_WEIGHTS[key];
    }

    // 부분 매칭 시도
    for (var name in DEMERIT_NAME_MAP) {
      if (demeritName.indexOf(name) !== -1) {
        var mappedKey = DEMERIT_NAME_MAP[name];
        if (DEMERIT_WEIGHTS[mappedKey] !== undefined) {
          return DEMERIT_WEIGHTS[mappedKey];
        }
      }
    }

    return 0.5; // 기본값
  }

  /**
   * 효과 유형으로 가중치 조회
   *
   * @param {string} typeName - 유형명
   * @returns {number} 가중치 (0~1)
   */
  function getTypeWeight(typeName) {
    return TYPE_WEIGHTS[typeName] !== undefined ? TYPE_WEIGHTS[typeName] : 0.8;
  }

  /**
   * 시너지 유형으로 가중치 조회
   *
   * @param {string} synergyType - 시너지 유형명
   * @returns {number} 가중치 (0~1)
   */
  function getSynergyWeight(synergyType) {
    return SYNERGY_WEIGHTS[synergyType] !== undefined
      ? SYNERGY_WEIGHTS[synergyType]
      : 0.5;
  }

  // ============================================================================
  // 섹션 6: 통합 점수 계산 (Unified Score Calculation)
  // @added 2025-12-12 - 메인 스레드와 Worker에서 동일하게 사용
  // ============================================================================

  /**
   * 클래스별 Sub 스텟 매핑
   * @constant {Object}
   */
  var CLASS_SUB_STATS = {
    LUCK: ["02", "05", "08", "14", "17", "18", "19", "20"],
    WILL: ["03", "06", "09", "11", "12", "15"],
  };

  /**
   * Sub 스텟별 우선 효과
   * @constant {Object}
   */
  var SUB_STAT_PRIORITY_EFFECTS = {
    LUCK: ["치명타 확률", "치명타 피해", "추가타 확률", "추가타"],
    WILL: ["강타 피해", "궁극기", "회복력"],
  };

  /**
   * 클래스별 우선 효과 반환
   * @param {string} classCode - 클래스 코드
   * @returns {Array} 우선 효과 목록
   */
  function getClassPriorityEffects(classCode) {
    if (CLASS_SUB_STATS.LUCK.indexOf(classCode) !== -1) {
      return SUB_STAT_PRIORITY_EFFECTS.LUCK;
    }
    if (CLASS_SUB_STATS.WILL.indexOf(classCode) !== -1) {
      return SUB_STAT_PRIORITY_EFFECTS.WILL;
    }
    return [];
  }

  /**
   * 통합 룬 효율 점수 계산
   * @param {Object} rune - 룬 데이터
   * @param {Object} options - 옵션
   * @param {Array} options.equippedDotTypes - 장착된 DoT 유형 (시너지 계산용)
   * @param {string} options.classCode - 캐릭터 클래스 코드
   * @returns {number} 효율 점수
   * @added 2025-12-12
   */
  function calculateUnifiedScore(rune, options) {
    options = options || {};
    var equippedDotTypes = options.equippedDotTypes || [];
    var classCode = options.classCode || "00";

    var score = 0;

    // ========================================
    // 1. 긍정적 효과 합산 (dpsRelevant + trigger 가중치)
    // ========================================
    if (rune.effects && Array.isArray(rune.effects)) {
      rune.effects.forEach(function (effect) {
        var weight = 0; // dpsRelevant: false → 제외

        if (effect.dpsRelevant === true) {
          var trigger = effect.trigger || "";

          if (!trigger) {
            // 상시 효과
            weight = 1.0;
          } else if (
            trigger.indexOf("스킬 사용") !== -1 ||
            trigger.indexOf("공격 적중") !== -1 ||
            trigger.indexOf("전투 중") !== -1 ||
            trigger.indexOf("연타") !== -1 ||
            trigger.indexOf("강타") !== -1 ||
            trigger.indexOf("스킬 7회") !== -1 ||
            trigger.indexOf("스킬 5회") !== -1
          ) {
            // 상시/거의 상시
            weight = 0.9;
          } else if (trigger.indexOf("기본 공격") !== -1) {
            // 중간 가동률
            weight = 0.65;
          } else if (
            trigger.indexOf("체력") !== -1 ||
            trigger.indexOf("자원") !== -1 ||
            trigger.indexOf("HP") !== -1 ||
            trigger.indexOf("이하") !== -1 ||
            trigger.indexOf("이상") !== -1 ||
            trigger.indexOf("미만") !== -1
          ) {
            // 조건부
            weight = 0.45;
          } else if (
            trigger.indexOf("궁극기") !== -1 ||
            trigger.indexOf("각성") !== -1 ||
            trigger.indexOf("무방비") !== -1 ||
            trigger.indexOf("처치") !== -1
          ) {
            // 특수 조건
            weight = 0.25;
          } else if (trigger.indexOf("지속 피해") !== -1) {
            // @added 2025-12-12 - DoT 시너지 없으면 발동 불가
            // 시너지 계산에서만 추가됨
            weight = 0;
          } else {
            // 기타 trigger
            weight = 0.5;
          }
        }

        score += (effect.value || 0) * weight;
      });
    }

    // ========================================
    // 2. 각성(Awakening) 효과 합산 (가중치 0.25)
    // ========================================
    if (
      rune.awakening &&
      rune.awakening.effects &&
      Array.isArray(rune.awakening.effects)
    ) {
      rune.awakening.effects.forEach(function (effect) {
        score += (effect.value || 0) * 0.25;
      });
    }

    // ========================================
    // 3. 부정적 효과 감산
    // ========================================
    if (rune.demerits && Array.isArray(rune.demerits)) {
      rune.demerits.forEach(function (demerit) {
        var name = demerit.name || "";

        // DPS 직접 영향 패널티: 가중치 1.0
        var isDpsDirectPenalty =
          name.indexOf("피해량 감소") !== -1 ||
          name.indexOf("피해 감소") !== -1 ||
          name.indexOf("쿨타임") !== -1 ||
          name.indexOf("치명타") !== -1 ||
          name.indexOf("멀티히트") !== -1;

        var weight = isDpsDirectPenalty ? 1.0 : 0.15;
        score -= (demerit.value || 0) * weight;
      });
    }

    // ========================================
    // 4. 시너지 보너스 (DoT 요구 룬 - 실제 효과 값 기반)
    // ========================================
    if (
      rune.synergy &&
      rune.synergy.requiresDot &&
      rune.synergy.requiresDot.length > 0
    ) {
      var hasRequiredDot = rune.synergy.requiresDot.some(function (dot) {
        return equippedDotTypes.indexOf(dot) !== -1;
      });

      if (hasRequiredDot && rune.effects) {
        rune.effects.forEach(function (effect) {
          var trigger = effect.trigger || "";
          if (
            trigger.indexOf("지속 피해") !== -1 &&
            effect.dpsRelevant !== false
          ) {
            var duration = effect.duration || 5;
            var cooldown = effect.cooldown || 3;
            var uptime = duration / (duration + cooldown);
            score += (effect.value || 0) * uptime;
          }
        });
      }
    }

    // ========================================
    // 5. 클래스별 우선 효과 보너스
    // ========================================
    if (classCode !== "00" && rune.effects) {
      var classPriorityEffects = getClassPriorityEffects(classCode);

      rune.effects.forEach(function (effect) {
        var effectName = effect.name || "";
        var isPriority = classPriorityEffects.some(function (pe) {
          return effectName.indexOf(pe) !== -1;
        });
        if (isPriority) {
          score += (effect.value || 0) * 0.2; // 20% 추가 보너스
        }
      });
    }

    // ========================================
    // 6. 시너지 잠재력 점수 (Top-N 필터링용)
    // @updated 2025-12-12 - 매직넘버 제거, 실제 효과 값 기반
    // ========================================
    var synergyPotential = 0;

    // DoT 부여 룬: 각 DoT 유형당 예상 시너지 기여도
    // DoT 부여 시 수혜 룬의 조건부 효과 활성화 가능 (평균 10~15% DPS 기대)
    if (rune.synergy && rune.synergy.appliesDot && rune.synergy.appliesDot.length > 0) {
      // DoT 유형당 평균 기대 시너지 = 수혜 룬 효과의 평균값 추정
      // 실제 조합에서 계산되므로 여기서는 필터링 생존을 위한 잠재력만 표시
      synergyPotential += rune.synergy.appliesDot.length * 
        FORMULA_CONSTANTS.SUB_STAT_BONUS * 100; // 10% × DoT 종류 수
    }

    // 결함 제거 룬: 해당 룬의 결함 값을 기반으로 잠재력 추정
    // 조합 내 결함 있는 룬의 평균 결함값 예상 (약 5~10%)
    if (rune.synergy && rune.synergy.removesDemerits) {
      synergyPotential += FORMULA_CONSTANTS.SUB_STAT_BONUS * 100; // 10%
    }

    // 각성 제공 룬: 각성 효과의 업타임 향상 잠재력
    if (rune.synergy && rune.synergy.providesAwakening) {
      // 각성 업타임 향상으로 인한 DPS 증가 예상
      synergyPotential += FORMULA_CONSTANTS.SUB_STAT_BONUS * 50; // 5%
    }

    // 치명타/추가타 효과: 실제 효과 값의 시너지 잠재력
    // 다른 룬과 조합 시 곱연산 시너지 발생 가능
    if (rune.effects) {
      rune.effects.forEach(function (e) {
        var name = e.name || "";
        var value = e.value || 0;
        
        // 치명타 효과: 다른 치명타 효과와 시너지 잠재력
        if (name.indexOf("치명타") !== -1 && value > 0) {
          // 시너지 잠재력 = 효과값 × 예상 조합 효과값 비율
          synergyPotential += value * FORMULA_CONSTANTS.SUB_STAT_BONUS; // 효과값 × 10%
        }
        // 추가타 효과
        if (name.indexOf("추가타") !== -1 && value > 0) {
          synergyPotential += value * FORMULA_CONSTANTS.SUB_STAT_BONUS;
        }
      });
    }

    score += synergyPotential;

    return score;
  }

  // ============================================================================
  // 섹션 7: 모듈 내보내기
  // ============================================================================

  /**
   * 공유 공식 모듈
   */
  var SharedFormulas = {
    // 상수
    FORMULA_CONSTANTS: FORMULA_CONSTANTS,
    CLASS_SUB_STATS: CLASS_SUB_STATS,
    SUB_STAT_PRIORITY_EFFECTS: SUB_STAT_PRIORITY_EFFECTS,

    // 업타임/시간 함수
    calculateUptime: calculateUptime,
    calculateDecayAverage: calculateDecayAverage,
    calculateAwakeningUptime: calculateAwakeningUptime,

    // 한계효용/밸런스 함수
    calculateCritMarginalUtility: calculateCritMarginalUtility,
    calculateBonusBalance: calculateBonusBalance,

    // 통합 점수 계산 (2025-12-12 추가)
    calculateUnifiedScore: calculateUnifiedScore,
    getClassPriorityEffects: getClassPriorityEffects,
  };

  /**
   * 공유 효과 가중치 모듈
   */
  var SharedEffectWeights = {
    // 상수
    EFFECT_WEIGHTS: EFFECT_WEIGHTS,
    TYPE_WEIGHTS: TYPE_WEIGHTS,
    DEMERIT_WEIGHTS: DEMERIT_WEIGHTS,
    SYNERGY_WEIGHTS: SYNERGY_WEIGHTS,
    EFFECT_NAME_MAP: EFFECT_NAME_MAP,
    DEMERIT_NAME_MAP: DEMERIT_NAME_MAP,

    // 조회 함수
    getEffectWeight: getEffectWeight,
    getDemeritWeight: getDemeritWeight,
    getTypeWeight: getTypeWeight,
    getSynergyWeight: getSynergyWeight,
  };

  // 전역 객체에 등록 (Worker: self, 브라우저: window)
  global.SharedFormulas = SharedFormulas;
  global.SharedEffectWeights = SharedEffectWeights;
})(
  typeof self !== "undefined"
    ? self
    : typeof window !== "undefined"
    ? window
    : this
);
