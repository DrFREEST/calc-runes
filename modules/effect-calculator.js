/**
 * ============================================
 * 효과 합산 모듈
 * ============================================
 * @file        modules/effect-calculator.js
 * @description 장착된 룬의 효과 합산 및 표시
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.EffectCalculator)
 * - 장착된 룬들의 효과를 합산하여 UI에 표시
 * 
 * @requires EffectParser (modules/effect-parser.js)
 * @requires Utils (modules/utils.js)
 */

(function() {
    'use strict';

    // ============================================
    // 외부 모듈 참조
    // ============================================

    // DOM 선택자 (Utils 모듈 참조)
    function $(selector) {
        if (window.Utils && window.Utils.$) {
            return window.Utils.$(selector);
        }
        return document.querySelector(selector);
    }

    function escapeHtml(text) {
        if (window.Utils && window.Utils.escapeHtml) {
            return window.Utils.escapeHtml(text);
        }
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getParser() {
        return window.EffectParser || {};
    }

    function getState() {
        if (window.RuneCalculator && window.RuneCalculator.getState) {
            return window.RuneCalculator.getState();
        }
        return { equippedRunes: {}, enhanceLevels: {} };
    }

    /**
     * 외부 함수 참조 (RuneCalculator에서 제공)
     * @updated 2025-12-11 - 모듈 의존성 해결
     */
    function getAllEquippedDotTypes() {
        if (window.RuneCalculator && window.RuneCalculator.getAllEquippedDotTypes) {
            return window.RuneCalculator.getAllEquippedDotTypes();
        }
        return [];
    }

    function checkSynergyRunes(runes) {
        const EP = getParser();
        if (EP.checkSynergyRunes) {
            return EP.checkSynergyRunes(runes);
        }
        return { hasSynergy: false, synergyTypes: [], totalBoost: 1.0 };
    }

    // getCharacterStatsFromInput은 아래에서 직접 정의됨 (179줄)

    function calculateRuneEfficiencyScore(rune, enhanceLevel, dotTypes, index, options) {
        const EP = getParser();
        if (EP.calculateRuneEfficiencyScore) {
            return EP.calculateRuneEfficiencyScore(rune, enhanceLevel, dotTypes, index, options);
        }
        return { score: 0, effectiveSummary: {}, breakdown: [] };
    }

// ============================================
// 10. 효과 합산 (Effect Calculator)
// ============================================

/**
 * 장착된 모든 룬의 효과 합산
 * @updated 2025-12-10 - 고급 효과 파싱 엔진 사용
 * @updated 2025-12-10 - DPS 핵심 효과 구분 표시
 * @updated 2025-12-10 - 한계효용 감소, 시너지 룬, DPS 분석 추가
 * @updated 2025-12-11 - 모듈 의존성 해결
 */
function calculateTotalEffects() {
    // 상태 가져오기
    const state = getState();

    const totalEffects = {
        coreDPS: {}, // DPS 핵심 효과
        demerits: {}, // 결함 효과 @added 2025-12-10
        conditionEffects: {}, // 상태 조건 효과 @added 2025-12-10
        other: {} // 기타 효과
    };

    // 모든 장착 룬의 지속 피해 유형 수집
    const allDotTypes = getAllEquippedDotTypes();
    const hasSynergy = allDotTypes.length > 0;

    // 시너지 룬 체크
    const synergyResult = checkSynergyRunes(Object.values(state.equippedRunes));

    // 현재 누적 효과 (한계효용 계산용)
    const currentEffects = {};

    // 캐릭터 스탯 (추천 탭에서 입력한 값 사용)
    const characterStats = getCharacterStatsFromInput();

    Object.entries(state.equippedRunes).forEach(([slotId, rune]) => {
        if (!rune) return;

        // 개별 슬롯 강화 수치 사용 @updated 2025-12-10
        const slotEnhanceLevel = state.enhanceLevels[slotId] || 0;

        // 고급 효과 계산 사용 (옵션 포함)
        const efficiency = calculateRuneEfficiencyScore(rune, slotEnhanceLevel, allDotTypes, 0, {
            currentEffects: currentEffects,
            characterStats: characterStats,
            synergyBoost: synergyResult.totalBoost
        });

        Object.entries(efficiency.effectiveSummary).forEach(([key, data]) => {
            // 효과 분류 @updated 2025-12-10
            let category;
            if (data.isDemerit) {
                category = 'demerits';
            } else if (data.isConditionEffect) {
                // 상태 조건 효과 (체력/자원 조건)
                category = 'conditionEffects';
            } else if (data.isCoreDPS) {
                category = 'coreDPS';
            } else {
                category = 'other';
            }

            // 실효값 사용
            if (!totalEffects[category][key]) {
                totalEffects[category][key] = {
                    total: 0,
                    isCoreDPS: data.isCoreDPS,
                    isDemerit: data.isDemerit,
                    isConditionEffect: data.isConditionEffect,
                    conditionInfo: data.conditionInfo,
                    diminished: data.diminished
                };
            }
            totalEffects[category][key].total += data.total;

            // 현재 효과 누적 (한계효용 계산용)
            if (!currentEffects[key]) {
                currentEffects[key] = 0;
            }
            currentEffects[key] += data.total;
        });
    });

    // DPS 분석 계산 (결함 효과, 상태 조건 효과 포함) @updated 2025-12-10
    // 상태 조건 효과의 실효값을 coreDPS에 추가하여 계산
    const combinedCoreDPS = Object.assign({}, totalEffects.coreDPS);
    Object.entries(totalEffects.conditionEffects || {}).forEach(function([key, data]) {
        if (data.isCoreDPS !== false) { // 핵심 DPS 효과인 상태 조건만 포함
            var baseEffectName = key.replace(/\s*\([^)]+\)\s*$/, '');
            if (!combinedCoreDPS[baseEffectName]) {
                combinedCoreDPS[baseEffectName] = {
                    total: 0
                };
            }
            combinedCoreDPS[baseEffectName].total += data.total;
        }
    });
    const dpsAnalysis = calculateExpectedDPS(combinedCoreDPS, characterStats, totalEffects.demerits);

    renderEffectSummary(totalEffects, hasSynergy, allDotTypes, synergyResult, dpsAnalysis);
}

/**
 * 캐릭터 스탯 입력값 가져오기
 * @returns {Object} 캐릭터 스탯 객체
 * @added 2025-12-10
 */
function getCharacterStatsFromInput() {
    var stats = {};

    // 추천 탭의 스탯 입력 필드에서 값 가져오기
    var critChanceInput = $('#stat-crit-chance');
    var critDmgInput = $('#stat-crit-damage');
    var multiHitInput = $('#stat-multi-hit');
    var additionalHitInput = $('#stat-additional-hit');

    if (critChanceInput && critChanceInput.value) {
        stats.critChance = parseFloat(critChanceInput.value) || 30;
    }
    if (critDmgInput && critDmgInput.value) {
        stats.critDmg = parseFloat(critDmgInput.value) || 150;
    }
    if (multiHitInput && multiHitInput.value) {
        stats.multiHit = parseFloat(multiHitInput.value) || 10;
    }
    if (additionalHitInput && additionalHitInput.value) {
        stats.additionalHit = parseFloat(additionalHitInput.value) || 5;
    }

    return stats;
}

/**
 * 효과 합산 결과 렌더링
 * @param {Object} totalEffects - 합산된 효과 { coreDPS: {}, other: {} }
 * @param {boolean} hasSynergy - 시너지 보유 여부
 * @param {Array} dotTypes - 보유 지속 피해 유형
 * @param {Object} synergyResult - 시너지 룬 정보
 * @param {Object} dpsAnalysis - DPS 분석 결과
 * @updated 2025-12-10 - DPS 핵심 효과와 기타 효과 분리 표시
 * @updated 2025-12-10 - DPS 분석, 공격력/피해량 비율, 시너지 룬 표시 추가
 */
function renderEffectSummary(totalEffects, hasSynergy, dotTypes, synergyResult, dpsAnalysis) {
    hasSynergy = hasSynergy || false;
    dotTypes = dotTypes || [];
    synergyResult = synergyResult || {
        synergies: [],
        hasSynergy: false
    };
    dpsAnalysis = dpsAnalysis || {
        totalDPSIncrease: 0,
        breakdown: {},
        balance: {}
    };

    const attackList = $('#effect-list-attack');
    const defenseList = $('#effect-list-defense');
    const miscList = $('#effect-list-misc');

    // DPS 핵심 효과 (공격 섹션에 표시)
    if (attackList) {
        const coreDPSEntries = Object.entries(totalEffects.coreDPS || {});
        let attackHtml = '';

        if (coreDPSEntries.length > 0) {
            attackHtml = `<div class="effect-section-header">⚡ DPS 핵심 효과</div>`;
            attackHtml += coreDPSEntries.map(function([key, data]) {
                return `
                    <div class="effect-item effect-item--core">
                        <span class="effect-item__name">${escapeHtml(key)}</span>
                        <span class="effect-item__value effect-item__value--highlight">
                            +${data.total.toFixed(1)}%
                        </span>
                    </div>
                `;
            }).join('');

            // 공격력/피해량 비율 표시
            var rawValues = dpsAnalysis.breakdown.rawValues || {};
            var atkIncrease = rawValues.atkIncrease || 0;
            var dmgIncrease = rawValues.dmgIncrease || 0;

            if (atkIncrease > 0 || dmgIncrease > 0) {
                var balance = dpsAnalysis.balance || {};
                var ratioText = '';
                var ratioClass = '';

                if (balance.isBalanced) {
                    ratioText = '✅ 균형 잡힌 세팅';
                    ratioClass = 'effect-item__value--balanced';
                } else if (atkIncrease > dmgIncrease + 20) {
                    ratioText = '⚠️ 피해량 증가 룬 추천';
                    ratioClass = 'effect-item__value--warning';
                } else {
                    ratioText = '⚠️ 공격력 증가 룬 추천';
                    ratioClass = 'effect-item__value--warning';
                }

                attackHtml += `
                    <div class="effect-divider"></div>
                    <div class="effect-section-header">📊 공격력/피해량 비율</div>
                    <div class="effect-item">
                        <span class="effect-item__name">공격력 : 피해량</span>
                        <span class="effect-item__value">${atkIncrease.toFixed(0)}% : ${dmgIncrease.toFixed(0)}%</span>
                    </div>
                    <div class="effect-item">
                        <span class="effect-item__name">비율 분석</span>
                        <span class="effect-item__value ${ratioClass}">${ratioText}</span>
                    </div>
                `;
            }

            // 예상 DPS 증가율 표시
            attackHtml += `
                <div class="effect-divider"></div>
                <div class="effect-section-header">🎯 예상 DPS 증가율</div>
                <div class="effect-item effect-item--dps">
                    <span class="effect-item__name">총 DPS 배율</span>
                    <span class="effect-item__value effect-item__value--dps">+${dpsAnalysis.totalDPSIncrease.toFixed(1)}%</span>
                </div>
            `;

            // DPS 계산 상세 (접기)
            var bd = dpsAnalysis.breakdown || {};
            // 속도 페널티가 있으면 표시 @updated 2025-12-10
            var speedMultiplierText = bd.speedMultiplier && bd.speedMultiplier < 1 ?
                ` × 속도 ×${bd.speedMultiplier}` :
                '';
            attackHtml += `
                <div class="effect-item effect-item--detail">
                    <span class="effect-item__name" style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
                        공격력 ×${bd.attackMultiplier || 1} × 피해량 ×${bd.damageMultiplier || 1} × 크리 ×${bd.critMultiplier || 1} × 연타 ×${bd.hitMultiplier || 1}${speedMultiplierText}
                    </span>
                </div>
            `;

            // 상태 조건 효과 표시 @added 2025-12-10
            const conditionEntries = Object.entries(totalEffects.conditionEffects || {});
            if (conditionEntries.length > 0) {
                attackHtml += `
                    <div class="effect-divider"></div>
                    <div class="effect-section-header" style="color: #93c5fd;">📊 상태 조건 효과 (업타임 적용)</div>
                `;
                attackHtml += conditionEntries.map(function([key, data]) {
                    var uptimeText = data.conditionInfo ?
                        `(업타임 ${data.conditionInfo.uptimePercent}%)` : '';
                    return `
                        <div class="effect-item effect-item--condition">
                        <span class="effect-item__name">${escapeHtml(key)}</span>
                            <span class="effect-item__value" style="color: #93c5fd;">
                                +${data.total.toFixed(1)}% ${uptimeText}
                        </span>
                    </div>
                `;
                }).join('');
            }

            // 결함 효과 표시 @added 2025-12-10
            const demeritEntries = Object.entries(totalEffects.demerits || {});
            if (demeritEntries.length > 0) {
                attackHtml += `
                    <div class="effect-divider"></div>
                    <div class="effect-section-header" style="color: #fca5a5;">⚠️ 결함 효과 (감점)</div>
                `;
                attackHtml += demeritEntries.map(function([key, data]) {
                    // "(결함)" 텍스트 제거하고 표시
                    const displayName = key.replace(' (결함)', '');
                    return `
                        <div class="effect-item effect-item--demerit">
                            <span class="effect-item__name">${escapeHtml(displayName)}</span>
                            <span class="effect-item__value">
                                -${data.total.toFixed(1)}%
                            </span>
                        </div>
                    `;
                }).join('');
            }
        } else {
            attackHtml = '<p class="effect-empty">장착된 룬이 없습니다</p>';
        }

        attackList.innerHTML = attackHtml;
    }

    // 기타 효과 (방어 섹션에 표시)
    if (defenseList) {
        const otherEntries = Object.entries(totalEffects.other || {});
        if (otherEntries.length > 0) {
            defenseList.innerHTML = `
                <div class="effect-section-header">📋 기타 효과 (점수 미반영)</div>
            ` + otherEntries.map(function([key, data]) {
                const isNegative = key.includes('증가') && (key.includes('받는') || key.includes('재사용'));
                const value = data.total;
                return `
                    <div class="effect-item effect-item--other">
                        <span class="effect-item__name">${escapeHtml(key)}</span>
                        <span class="effect-item__value ${isNegative ? 'effect-item__value--negative' : 'effect-item__value--muted'}">
                            ${value >= 0 ? '+' : ''}${value.toFixed(1)}%
                        </span>
                    </div>
                `;
            }).join('');
        } else {
            defenseList.innerHTML = '<p class="effect-empty">기타 효과 없음</p>';
        }
    }

    // 시너지 정보 (기타 섹션에 표시)
    if (miscList) {
        let miscHtml = '';

        // 시너지 룬 정보 추가 (새로운 기능)
        if (synergyResult.hasSynergy && synergyResult.synergies.length > 0) {
            miscHtml += `<div class="effect-section-header">✨ 시너지 룬 효과</div>`;
            synergyResult.synergies.forEach(function(syn) {
                miscHtml += `
                    <div class="effect-item effect-item--synergy">
                        <span class="effect-item__name">${escapeHtml(syn.runeName)}</span>
                        <span class="effect-item__value" style="color: var(--color-accent-purple);">
                            ${syn.description}
                        </span>
                    </div>
                `;
            });
        }

        // 지속 피해 시너지 정보 추가
        if (dotTypes.length > 0) {
            miscHtml += `
                <div class="effect-divider"></div>
                <div class="effect-section-header">🔗 적 상태 시너지</div>
                <div class="effect-item">
                    <span class="effect-item__name">활성화된 시너지</span>
                    <span class="effect-item__value" style="color: var(--color-accent-warning);">
                        ${dotTypes.length}종
                    </span>
                </div>
                <div class="effect-item">
                    <span class="effect-item__name" style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
                        ${dotTypes.join(', ')}
                    </span>
                </div>
            `;
        }

        if (miscHtml) {
            miscList.innerHTML = miscHtml;
        } else {
            miscList.innerHTML = '<p class="effect-empty">장착된 룬이 없습니다</p>';
        }
    }
}

// ============================================

    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * EffectCalculator 전역 객체
     * @global
     */
    window.EffectCalculator = {
        calculateTotalEffects: typeof calculateTotalEffects !== 'undefined' ? calculateTotalEffects : null
    };

    console.log('✅ EffectCalculator 모듈 로드 완료');

})();
