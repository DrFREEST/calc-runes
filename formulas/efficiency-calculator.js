/**
 * ============================================================================
 * 마비노기 모바일 룬 효율 계산기 - 효율 점수 계산기
 * ============================================================================
 * @file efficiency-calculator.js
 * @description 룬 효율 점수 계산 및 동적 가중치 조정
 * @author AI Assistant
 * @created 2025-12-11
 * 
 * @architecture
 * - EfficiencyCalculator: 개별 룬 및 조합 효율 점수 계산
 * - 클래스별 스텟, 현재 보유 스텟에 따른 동적 가중치 조정
 * - 시너지 보너스 계산
 * 
 * @dependencies
 * - class-stats.js (ClassStats)
 * - effect-weights.js (EffectWeights)
 * - stat-formulas.js (StatFormulas)
 * ============================================================================
 */

'use strict';

// ============================================================================
// 섹션 1: 기본 설정
// ============================================================================

/**
 * 효율 계산기 기본 설정
 * 
 * @constant {Object}
 */
const CALCULATOR_CONFIG = Object.freeze({
  /** Sub 스텟 관련 효과 가중치 보정값 */
  SUB_STAT_BONUS: 0.1,
  
  /** 공격력/피해량 밸런스 최대 보정 계수 */
  BALANCE_MAX_MULTIPLIER: 1.3,
  
  /** 시너지 룬 목록 */
  SYNERGY_RUNES: {
    /** 결함 제거 룬 */
    DEMERIT_REMOVAL: ['영원'],
    
    /** 각성 쿨타임 감소 룬 */
    AWAKENING_COOLDOWN: ['눈 먼 예언자'],
    
    /** 각성 2배 효과 룬 */
    AWAKENING_DOUBLE: ['압도적인 힘', '섬세한 손놀림'],
    
    /** 중첩 보너스 룬 */
    STACKING_BONUS: ['쌍둥이 별', '에메랄드 숲'],
    
    /** DoT 부여 룬 (출처) */
    DOT_PROVIDERS: {
      '출혈': ['야수+'],
      '화상': ['불길', '메아리치는 진노'],
      '빙결': ['결정', '메아리치는 진노'],
      '감전': ['뇌명'],
      '정신': ['밤+']
    },
    
    /** DoT 시너지 룬 (수혜) */
    DOT_BENEFICIARIES: {
      '출혈': ['절개+'],
      '화상': ['들불'],
      '빙결': ['설산'],
      '감전': ['세상을 삼키는 악의'],
      '정신': ['환영+']
    }
  },
  
  /** 눈 먼 예언자 각성 쿨타임 감소량 (초) */
  BLIND_PROPHET_COOLDOWN_REDUCTION: 38
});

// ============================================================================
// 섹션 2: 캐릭터 스텟 클래스
// ============================================================================

/**
 * 캐릭터 스텟 관리 클래스
 * 
 * @class CharacterStats
 */
class CharacterStats {
  /**
   * @param {Object} stats - 스텟 초기값
   */
  constructor(stats = {}) {
    // 클래스 정보
    this.className = stats.className || '전사';
    
    // 기본 스텟
    this.attack = stats.attack || 1;
    this.defense = stats.defense || 1;
    
    // 보조 스텟
    this.critical = stats.critical || 0;
    this.additionalHit = stats.additionalHit || 0;
    this.heavyHit = stats.heavyHit || 0;
    this.comboHit = stats.comboHit || 0;
    this.skillPower = stats.skillPower || 0;
    
    // 현재 장착 룬으로부터의 보너스 (%)
    this.attackBonus = stats.attackBonus || 0;
    this.damageBonus = stats.damageBonus || 0;
    this.critRateBonus = stats.critRateBonus || 0;
    this.critDamageBonus = stats.critDamageBonus || 0;
    this.additionalHitBonus = stats.additionalHitBonus || 0;
    this.heavyHitBonus = stats.heavyHitBonus || 0;
    this.comboHitBonus = stats.comboHitBonus || 0;
    this.skillDamageBonus = stats.skillDamageBonus || 0;
  }
  
  /**
   * 클래스 정보 조회
   * 
   * @returns {Object|null} 클래스 스텟 정보
   */
  getClassInfo() {
    if (typeof window !== 'undefined' && window.ClassStats) {
      return window.ClassStats.getClassStats(this.className);
    }
    return null;
  }
  
  /**
   * Sub 스텟 관련 우선 효과 목록 조회
   * 
   * @returns {Array<string>} 우선 효과 목록
   */
  getPriorityEffects() {
    const classInfo = this.getClassInfo();
    return classInfo ? classInfo.priorityEffects : [];
  }
}

// ============================================================================
// 섹션 3: 개별 룬 효율 계산
// ============================================================================

/**
 * 개별 룬의 효율 점수 계산
 * 
 * @param {Object} rune - 룬 데이터
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @param {number} [enhanceLevel=0] - 강화 단계 (0, 10, 15)
 * @returns {Object} { score, breakdown } 효율 점수 및 상세 내역
 */
function calculateRuneEfficiency(rune, characterStats, enhanceLevel = 0) {
  const breakdown = {
    effectScores: [],
    demeritScores: [],
    enhanceScores: [],
    awakeningScore: 0,
    totalEffectScore: 0,
    totalDemeritScore: 0,
    totalEnhanceScore: 0,
    classBonus: 0,
    balanceBonus: 0,
    marginalUtilityAdjustment: 0
  };
  
  // 1. 기본 효과 점수 계산
  if (rune.effects && Array.isArray(rune.effects)) {
    rune.effects.forEach(function(effect) {
      const score = calculateEffectScore(effect, characterStats);
      breakdown.effectScores.push({
        name: effect.name,
        value: effect.value,
        score: score
      });
      breakdown.totalEffectScore += score;
    });
  }
  
  // 2. 결함 점수 계산
  if (rune.demerits && Array.isArray(rune.demerits)) {
    rune.demerits.forEach(function(demerit) {
      const score = calculateDemeritScore(demerit);
      breakdown.demeritScores.push({
        name: demerit.name,
        value: demerit.value,
        score: score
      });
      breakdown.totalDemeritScore += score;
    });
  }
  
  // 3. 강화 효과 점수 계산
  if (enhanceLevel > 0 && rune.enhanceEffects) {
    var enhanceKey = String(enhanceLevel);
    if (rune.enhanceEffects[enhanceKey]) {
      rune.enhanceEffects[enhanceKey].forEach(function(effect) {
        var score = calculateEffectScore(effect, characterStats);
        breakdown.enhanceScores.push({
          level: enhanceLevel,
          name: effect.name,
          value: effect.value,
          score: score
        });
        breakdown.totalEnhanceScore += score;
      });
    }
    
    // +15 강화 시 +10 효과도 포함
    if (enhanceLevel === 15 && rune.enhanceEffects['10']) {
      rune.enhanceEffects['10'].forEach(function(effect) {
        var score = calculateEffectScore(effect, characterStats);
        breakdown.enhanceScores.push({
          level: 10,
          name: effect.name,
          value: effect.value,
          score: score
        });
        breakdown.totalEnhanceScore += score;
      });
    }
  }
  
  // 4. 각성 효과 점수 계산 (엠블럼 룬)
  if (rune.awakening) {
    breakdown.awakeningScore = calculateAwakeningScore(rune.awakening, characterStats);
  }
  
  // 5. 클래스별 가중치 보정
  breakdown.classBonus = calculateClassBonus(rune, characterStats);
  
  // 6. 공격력/피해량 밸런스 보정
  breakdown.balanceBonus = calculateBalanceBonus(rune, characterStats);
  
  // 7. 한계효용 조정 (치명타 등)
  breakdown.marginalUtilityAdjustment = calculateMarginalUtilityAdjustment(rune, characterStats);
  
  // 최종 점수 계산
  var baseScore = breakdown.totalEffectScore + breakdown.totalEnhanceScore + breakdown.awakeningScore;
  var adjustedScore = baseScore - breakdown.totalDemeritScore;
  var finalScore = adjustedScore + breakdown.classBonus + breakdown.balanceBonus + breakdown.marginalUtilityAdjustment;
  
  return {
    score: Math.max(0, finalScore),
    breakdown: breakdown
  };
}

/**
 * 개별 효과 점수 계산
 * 
 * @param {Object} effect - 효과 데이터
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @returns {number} 효과 점수
 */
function calculateEffectScore(effect, characterStats) {
  // 효과 가중치 조회
  var effectWeight = 0;
  if (typeof window !== 'undefined' && window.EffectWeights) {
    effectWeight = window.EffectWeights.getEffectWeight(effect.name);
  }
  
  if (effectWeight === 0) {
    return 0; // DPS 무관 효과
  }
  
  // 유형 가중치 조회
  var typeWeight = 1.0;
  if (effect.type && typeof window !== 'undefined' && window.EffectWeights) {
    typeWeight = window.EffectWeights.getTypeWeight(effect.type);
    
    // DURATION/DECAY/AWAKENING은 동적 계산
    if (effect.type === 'DURATION' && effect.duration && effect.cooldown) {
      if (typeof window !== 'undefined' && window.StatFormulas) {
        typeWeight = window.StatFormulas.calculateUptime(effect.duration, effect.cooldown);
      }
    } else if (effect.type === 'DECAY' && effect.initialValue && effect.decayRate && effect.decayInterval) {
      if (typeof window !== 'undefined' && window.StatFormulas) {
        var avgValue = window.StatFormulas.calculateDecayAverage(
          effect.initialValue, 
          effect.decayRate, 
          effect.decayInterval
        );
        // 평균값/초기값 비율을 유형 가중치로 사용
        typeWeight = avgValue / effect.initialValue;
      }
    } else if (effect.type === 'STACKING' && effect.maxStacks) {
      // 중첩 효과는 최대 중첩 기준
      typeWeight = 0.95;
    }
  }
  
  // 효과값
  var value = effect.value || 0;
  
  // 중첩 효과인 경우 최대값 적용
  if (effect.maxStacks && effect.valuePerStack) {
    value = effect.valuePerStack * effect.maxStacks;
  }
  
  return value * effectWeight * typeWeight;
}

/**
 * 결함 점수 계산
 * 
 * @param {Object} demerit - 결함 데이터
 * @returns {number} 결함 점수
 */
function calculateDemeritScore(demerit) {
  var demeritWeight = 0;
  if (typeof window !== 'undefined' && window.EffectWeights) {
    demeritWeight = window.EffectWeights.getDemeritWeight(demerit.name);
  }
  
  return (demerit.value || 0) * demeritWeight;
}

/**
 * 각성 효과 점수 계산
 * 
 * @param {Object} awakening - 각성 효과 데이터
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @returns {number} 각성 효과 점수
 */
function calculateAwakeningScore(awakening, characterStats) {
  if (!awakening || !awakening.effects) {
    return 0;
  }
  
  var duration = awakening.duration || 20;
  var uptime = 0;
  
  if (typeof window !== 'undefined' && window.StatFormulas) {
    uptime = window.StatFormulas.calculateAwakeningUptime(duration, 0);
  } else {
    uptime = duration / (duration + 90); // 기본 계산
  }
  
  var totalScore = 0;
  
  awakening.effects.forEach(function(effect) {
    var effectScore = calculateEffectScore(effect, characterStats);
    totalScore += effectScore * uptime;
  });
  
  return totalScore;
}

/**
 * 클래스별 가중치 보정 계산
 * 
 * @param {Object} rune - 룬 데이터
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @returns {number} 클래스 보정 점수
 */
function calculateClassBonus(rune, characterStats) {
  var priorityEffects = characterStats.getPriorityEffects();
  if (!priorityEffects || priorityEffects.length === 0) {
    return 0;
  }
  
  var bonus = 0;
  
  if (rune.effects && Array.isArray(rune.effects)) {
    rune.effects.forEach(function(effect) {
      var effectName = effect.name || '';
      
      // 우선 효과에 해당하는지 확인
      var isPriority = priorityEffects.some(function(priority) {
        return effectName.indexOf(priority) !== -1;
      });
      
      if (isPriority) {
        // Sub 스텟 보정 적용
        bonus += (effect.value || 0) * CALCULATOR_CONFIG.SUB_STAT_BONUS;
      }
    });
  }
  
  return bonus;
}

/**
 * 공격력/피해량 밸런스 보정 계산
 * 
 * @param {Object} rune - 룬 데이터
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @returns {number} 밸런스 보정 점수
 */
function calculateBalanceBonus(rune, characterStats) {
  if (!rune.effects || !Array.isArray(rune.effects)) {
    return 0;
  }
  
  var balance = { attackMultiplier: 1, damageMultiplier: 1 };
  
  if (typeof window !== 'undefined' && window.StatFormulas) {
    balance = window.StatFormulas.calculateBonusBalance(
      characterStats.attackBonus,
      characterStats.damageBonus
    );
  }
  
  var bonus = 0;
  
  rune.effects.forEach(function(effect) {
    var effectName = effect.name || '';
    var value = effect.value || 0;
    
    if (effectName.indexOf('공격력') !== -1) {
      // 공격력 증가인 경우
      bonus += value * (balance.attackMultiplier - 1);
    } else if (effectName.indexOf('피해량') !== -1 || effectName.indexOf('피해') !== -1) {
      // 피해량 증가인 경우
      bonus += value * (balance.damageMultiplier - 1);
    }
  });
  
  return bonus;
}

/**
 * 한계효용 조정 계산
 * 
 * @param {Object} rune - 룬 데이터
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @returns {number} 한계효용 조정 점수
 */
function calculateMarginalUtilityAdjustment(rune, characterStats) {
  if (!rune.effects || !Array.isArray(rune.effects)) {
    return 0;
  }
  
  var adjustment = 0;
  
  rune.effects.forEach(function(effect) {
    var effectName = effect.name || '';
    var value = effect.value || 0;
    
    // 치명타 확률 한계효용 적용
    if (effectName.indexOf('치명타 확률') !== -1 || effectName === '치명타') {
      var currentCritRate = 0;
      
      if (typeof window !== 'undefined' && window.StatFormulas) {
        currentCritRate = window.StatFormulas.calculateCritRate(
          characterStats.critical,
          characterStats.critRateBonus
        );
        
        var marginalUtility = window.StatFormulas.calculateCritMarginalUtility(currentCritRate);
        
        // 한계효용이 낮으면 점수 감소
        if (marginalUtility < 1) {
          var baseWeight = 0.7; // 치명타 확률 기본 가중치
          var reducedScore = value * baseWeight * (1 - marginalUtility);
          adjustment -= reducedScore;
        }
      }
    }
  });
  
  return adjustment;
}

// ============================================================================
// 섹션 4: 시너지 보너스 계산
// ============================================================================

/**
 * 룬 조합의 시너지 보너스 계산
 * 
 * @param {Array<Object>} equippedRunes - 장착된 룬 배열
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @returns {Object} { totalBonus, details } 시너지 보너스 및 상세 내역
 */
function calculateSynergyBonus(equippedRunes, characterStats) {
  var details = [];
  var totalBonus = 0;
  
  var runeNames = equippedRunes.map(function(r) { return r.name; });
  
  // 1. 결함 제거 시너지 (영원 룬)
  var hasEternal = runeNames.some(function(name) {
    return CALCULATOR_CONFIG.SYNERGY_RUNES.DEMERIT_REMOVAL.indexOf(name) !== -1;
  });
  
  if (hasEternal) {
    equippedRunes.forEach(function(rune) {
      if (rune.demerits && rune.demerits.length > 0) {
        rune.demerits.forEach(function(demerit) {
          var demeritScore = calculateDemeritScore(demerit);
          totalBonus += demeritScore; // 결함 점수 복구
          details.push({
            type: 'DEMERIT_REMOVAL',
            source: '영원',
            target: rune.name,
            bonus: demeritScore
          });
        });
      }
    });
  }
  
  // 2. 각성 쿨타임 감소 시너지 (눈 먼 예언자)
  var hasBlindProphet = runeNames.some(function(name) {
    return CALCULATOR_CONFIG.SYNERGY_RUNES.AWAKENING_COOLDOWN.indexOf(name) !== -1;
  });
  
  if (hasBlindProphet) {
    equippedRunes.forEach(function(rune) {
      if (rune.awakening && rune.awakening.effects) {
        var duration = rune.awakening.duration || 20;
        
        var baseUptime = 0;
        var newUptime = 0;
        
        if (typeof window !== 'undefined' && window.StatFormulas) {
          baseUptime = window.StatFormulas.calculateAwakeningUptime(duration, 0);
          newUptime = window.StatFormulas.calculateAwakeningUptime(
            duration, 
            CALCULATOR_CONFIG.BLIND_PROPHET_COOLDOWN_REDUCTION
          );
        } else {
          baseUptime = duration / (duration + 90);
          newUptime = duration / (duration + 52);
        }
        
        var uptimeIncrease = newUptime - baseUptime;
        
        // 각성 효과 점수에 업타임 증가분 적용
        var awakeningScore = calculateAwakeningScore(rune.awakening, characterStats) / baseUptime;
        var bonus = awakeningScore * uptimeIncrease;
        
        totalBonus += bonus;
        details.push({
          type: 'AWAKENING_COOLDOWN',
          source: '눈 먼 예언자',
          target: rune.name,
          bonus: bonus
        });
      }
    });
  }
  
  // 3. 각성 2배 효과 시너지
  var awakeningDoubleRune = equippedRunes.find(function(rune) {
    return CALCULATOR_CONFIG.SYNERGY_RUNES.AWAKENING_DOUBLE.indexOf(rune.name) !== -1;
  });
  
  if (awakeningDoubleRune) {
    // 각성 엠블럼 찾기
    var awakeningEmblem = equippedRunes.find(function(rune) {
      return rune.awakening && rune.category === '04';
    });
    
    if (awakeningEmblem) {
      var duration = awakeningEmblem.awakening.duration || 20;
      var uptime = 0;
      
      if (typeof window !== 'undefined' && window.StatFormulas) {
        var cooldownReduction = hasBlindProphet ? CALCULATOR_CONFIG.BLIND_PROPHET_COOLDOWN_REDUCTION : 0;
        uptime = window.StatFormulas.calculateAwakeningUptime(duration, cooldownReduction);
      } else {
        uptime = duration / (duration + 90);
      }
      
      // 압도적인힘/섬세한손놀림의 각성 시 추가 효과
      if (awakeningDoubleRune.effects) {
        var additionalEffects = awakeningDoubleRune.effects.filter(function(e) {
          return e.condition && e.condition.indexOf('각성') !== -1;
        });
        
        additionalEffects.forEach(function(effect) {
          var effectScore = calculateEffectScore(effect, characterStats);
          var bonus = effectScore * uptime;
          
          totalBonus += bonus;
          details.push({
            type: 'AWAKENING_DOUBLE',
            source: awakeningDoubleRune.name,
            target: awakeningEmblem.name,
            bonus: bonus
          });
        });
      }
    }
  }
  
  // 4. 중첩 보너스 시너지 (쌍둥이별/에메랄드숲)
  var stackBonusRune = equippedRunes.find(function(rune) {
    return CALCULATOR_CONFIG.SYNERGY_RUNES.STACKING_BONUS.indexOf(rune.name) !== -1;
  });
  
  if (stackBonusRune) {
    equippedRunes.forEach(function(rune) {
      if (rune.effects) {
        rune.effects.forEach(function(effect) {
          if (effect.type === 'STACKING' && effect.valuePerStack) {
            // 1중첩 추가 효과
            var bonus = effect.valuePerStack * 0.7; // 시너지 가중치
            totalBonus += bonus;
            details.push({
              type: 'STACKING_BONUS',
              source: stackBonusRune.name,
              target: rune.name,
              bonus: bonus
            });
          }
        });
      }
    });
  }
  
  // 5. DoT 시너지
  Object.keys(CALCULATOR_CONFIG.SYNERGY_RUNES.DOT_PROVIDERS).forEach(function(dotType) {
    var providers = CALCULATOR_CONFIG.SYNERGY_RUNES.DOT_PROVIDERS[dotType];
    var beneficiaries = CALCULATOR_CONFIG.SYNERGY_RUNES.DOT_BENEFICIARIES[dotType];
    
    var hasProvider = runeNames.some(function(name) {
      return providers.indexOf(name) !== -1;
    });
    
    if (hasProvider) {
      equippedRunes.forEach(function(rune) {
        if (beneficiaries.indexOf(rune.name) !== -1) {
          // DoT 조건 효과 활성화
          if (rune.effects) {
            rune.effects.forEach(function(effect) {
              if (effect.condition && effect.condition.indexOf(dotType) !== -1) {
                var effectScore = calculateEffectScore(effect, characterStats);
                var bonus = effectScore * 0.8; // DoT 시너지 가중치
                
                totalBonus += bonus;
                details.push({
                  type: 'DOT_SYNERGY',
                  dotType: dotType,
                  source: providers.find(function(p) { return runeNames.indexOf(p) !== -1; }),
                  target: rune.name,
                  bonus: bonus
                });
              }
            });
          }
        }
      });
    }
  });
  
  return {
    totalBonus: totalBonus,
    details: details
  };
}

// ============================================================================
// 섹션 5: 조합 효율 계산
// ============================================================================

/**
 * 룬 조합의 총 효율 점수 계산
 * 
 * @param {Array<Object>} equippedRunes - 장착된 룬 배열
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @param {Object} [enhanceLevels={}] - 룬별 강화 단계 { runeId: level }
 * @returns {Object} 조합 효율 정보
 */
function calculateCombinationEfficiency(equippedRunes, characterStats, enhanceLevels) {
  enhanceLevels = enhanceLevels || {};
  
  var runeScores = [];
  var totalRuneScore = 0;
  
  // 개별 룬 효율 계산
  equippedRunes.forEach(function(rune) {
    var enhanceLevel = enhanceLevels[rune.id] || 0;
    var result = calculateRuneEfficiency(rune, characterStats, enhanceLevel);
    
    runeScores.push({
      rune: rune,
      score: result.score,
      breakdown: result.breakdown
    });
    
    totalRuneScore += result.score;
  });
  
  // 시너지 보너스 계산
  var synergyResult = calculateSynergyBonus(equippedRunes, characterStats);
  
  // 총 효율 점수
  var totalScore = totalRuneScore + synergyResult.totalBonus;
  
  return {
    totalScore: totalScore,
    runeScores: runeScores,
    synergyBonus: synergyResult.totalBonus,
    synergyDetails: synergyResult.details
  };
}

/**
 * 동적 가중치가 적용된 효과 가중치 조회
 * 
 * @param {CharacterStats} characterStats - 캐릭터 스텟
 * @returns {Object} 조정된 효과 가중치
 */
function getAdjustedWeights(characterStats) {
  var baseWeights = {};
  
  if (typeof window !== 'undefined' && window.EffectWeights) {
    baseWeights = Object.assign({}, window.EffectWeights.EFFECT_WEIGHTS);
  }
  
  var adjustedWeights = Object.assign({}, baseWeights);
  
  // 1. 클래스 Sub 스텟 보정
  var classInfo = characterStats.getClassInfo();
  if (classInfo && classInfo.sub === 'LUCK') {
    adjustedWeights.CRIT_RATE = (adjustedWeights.CRIT_RATE || 0.7) + CALCULATOR_CONFIG.SUB_STAT_BONUS;
    adjustedWeights.ADDITIONAL_HIT_RATE = (adjustedWeights.ADDITIONAL_HIT_RATE || 0.7) + CALCULATOR_CONFIG.SUB_STAT_BONUS;
  } else if (classInfo && classInfo.sub === 'WILL') {
    adjustedWeights.HEAVY_HIT_DAMAGE = (adjustedWeights.HEAVY_HIT_DAMAGE || 0.6) + CALCULATOR_CONFIG.SUB_STAT_BONUS;
  }
  
  // 2. 치명타 한계효용 반영
  if (typeof window !== 'undefined' && window.StatFormulas) {
    var currentCritRate = window.StatFormulas.calculateCritRate(
      characterStats.critical,
      characterStats.critRateBonus
    );
    var marginalUtility = window.StatFormulas.calculateCritMarginalUtility(currentCritRate);
    adjustedWeights.CRIT_RATE = (adjustedWeights.CRIT_RATE || 0.7) * marginalUtility;
  }
  
  // 3. 공격력/피해량 밸런스 반영
  if (typeof window !== 'undefined' && window.StatFormulas) {
    var balance = window.StatFormulas.calculateBonusBalance(
      characterStats.attackBonus,
      characterStats.damageBonus
    );
    adjustedWeights.ATTACK_INCREASE = (adjustedWeights.ATTACK_INCREASE || 1.0) * balance.attackMultiplier;
    adjustedWeights.DAMAGE_INCREASE = (adjustedWeights.DAMAGE_INCREASE || 1.0) * balance.damageMultiplier;
  }
  
  return adjustedWeights;
}

// ============================================================================
// 섹션 6: 모듈 내보내기
// ============================================================================

var EfficiencyCalculator = {
  // 설정
  CALCULATOR_CONFIG: CALCULATOR_CONFIG,
  
  // 클래스
  CharacterStats: CharacterStats,
  
  // 개별 룬 계산
  calculateRuneEfficiency: calculateRuneEfficiency,
  calculateEffectScore: calculateEffectScore,
  calculateDemeritScore: calculateDemeritScore,
  calculateAwakeningScore: calculateAwakeningScore,
  
  // 보정 계산
  calculateClassBonus: calculateClassBonus,
  calculateBalanceBonus: calculateBalanceBonus,
  calculateMarginalUtilityAdjustment: calculateMarginalUtilityAdjustment,
  
  // 시너지 및 조합 계산
  calculateSynergyBonus: calculateSynergyBonus,
  calculateCombinationEfficiency: calculateCombinationEfficiency,
  
  // 동적 가중치
  getAdjustedWeights: getAdjustedWeights
};

// ES6 모듈 환경
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EfficiencyCalculator;
}

// 브라우저 환경 - 전역 객체에 등록
if (typeof window !== 'undefined') {
  window.EfficiencyCalculator = EfficiencyCalculator;
}

