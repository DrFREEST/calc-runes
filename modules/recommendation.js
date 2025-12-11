/**
 * ============================================
 * 추천 시스템 모듈
 * ============================================
 * @file        modules/recommendation.js
 * @description 캐릭터 스탯 기반 최적 룬 추천
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.Recommendation)
 * - 캐릭터 스탯과 역할에 맞는 최적 룬 조합 추천
 * 
 * @requires EffectParser (modules/effect-parser.js)
 * @requires Utils (modules/utils.js)
 */

(function() {
    'use strict';

    // ============================================
    // 외부 모듈 참조
    // ============================================

    function getParser() {
        return window.EffectParser || {};
    }

    function getState() {
        if (window.RuneCalculator && window.RuneCalculator.getState) {
            return window.RuneCalculator.getState();
        }
        return { allRunes: [], equippedRunes: {} };
    }

    function $(selector) {
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

// 11. 추천 시스템 (Recommendation)
// ============================================

/**
 * 룬 효율 점수 계산 (새로운 방식)
 * @param {Object} rune - 룬 데이터
 * @param {Object} stats - 캐릭터 스텟
 * @param {string} role - 역할군 (dealer/tank/healer/balanced)
 * @param {number} awakeningCooldownReduction - 각성 쿨타임 감소량 (엠블럼 시너지용)
 * @returns {number} 효율 점수
 * @updated 2025-12-10 - 고급 효과 파싱 엔진 통합
 * @updated 2025-12-10 - 엠블럼 각성 쿨타임 시너지 추가
 */
function calculateRuneScore(rune, stats, role, awakeningCooldownReduction) {
    awakeningCooldownReduction = awakeningCooldownReduction || 0;

    // 새로운 고급 효율 계산 사용
    const equippedDots = getAllEquippedDotTypes();
    const efficiency = calculateRuneEfficiencyScore(rune, 15, equippedDots, awakeningCooldownReduction);

    // 기본 점수 (새 엔진의 점수)
    let score = efficiency.score;

    // 역할별 추가 가중치 적용
    const roleMultipliers = {
        dealer: {
            '공격력 증가': 1.5,
            '피해량 증가': 1.5,
            '무방비 피해 증가': 1.3,
            '치명타 확률 증가': 1.2,
            '치명타 피해 증가': 1.2,
            '추가타 확률 증가': 1.2,
            '공격 속도 증가': 1.1,
            '재사용 대기시간 감소': 1.1,
            '받는 피해 감소': 0.5,
            '회복력 증가': 0.3
        },
        tank: {
            '받는 피해 감소': 2.0,
            '회복력 증가': 1.5,
            '회복량 증가': 1.5,
            '공격력 증가': 0.5,
            '피해량 증가': 0.5
        },
        healer: {
            '회복력 증가': 2.0,
            '회복량 증가': 2.0,
            '재사용 대기시간 감소': 1.5,
            '캐스팅 속도 증가': 1.3,
            '공격력 증가': 0.7,
            '피해량 증가': 0.5
        },
        balanced: {
            '공격력 증가': 1.0,
            '피해량 증가': 1.0,
            '받는 피해 감소': 1.0,
            '회복력 증가': 0.8
        }
    };

    const multipliers = roleMultipliers[role] || roleMultipliers.balanced;

    // 역할별 가중치로 점수 조정
    let roleAdjustment = 0;
    Object.entries(efficiency.effectiveSummary).forEach(([effectName, data]) => {
        const multiplier = multipliers[effectName] || 1.0;
        // 기본 점수에 역할 가중치 반영
        roleAdjustment += data.total * (multiplier - 1.0) * 5;
    });

    score += roleAdjustment;

    // 등급 보너스 (새 등급 체계)
    // @updated 2025-12-10 - 전설(시즌0) 통합으로 priority 조정 (유니크: 4)
    const gradeInfo = getGradeInfo(rune);
    if (gradeInfo) {
        const gradeBonus = {
            1: 100, // 신화
            2: 70, // 전설(시즌1)
            3: 50, // 전설(시즌0) - 통합
            4: 30 // 유니크(시즌0)
        };
        score += gradeBonus[gradeInfo.priority] || 0;
    }

    // 지속 피해 부여 룬은 시너지 보너스
    if (efficiency.dotTypes.length > 0) {
        score += efficiency.dotTypes.length * 10;
    }

    return Math.round(score * 10) / 10;
}

/**
 * 최적 룬 추천 실행
 */
function runRecommendation() {
    console.warn('🎯 추천 시작...');

    // 스텟 수집
    var statStr = $('#stat-str');
    var statDex = $('#stat-dex');
    var statInt = $('#stat-int');
    var statWil = $('#stat-wil');
    var statLuk = $('#stat-luk');
    var statAtk = $('#stat-atk');
    var statDef = $('#stat-def');

    const stats = {
        str: parseInt(statStr ? statStr.value : 0) || 0,
        dex: parseInt(statDex ? statDex.value : 0) || 0,
        int: parseInt(statInt ? statInt.value : 0) || 0,
        wil: parseInt(statWil ? statWil.value : 0) || 0,
        luk: parseInt(statLuk ? statLuk.value : 0) || 0,
        atk: parseInt(statAtk ? statAtk.value : 0) || 0,
        def: parseInt(statDef ? statDef.value : 0) || 0
    };

    var roleEl = $('#recommend-role');
    var classEl = $('#recommend-class');
    var gradeEl = $('#recommend-min-grade');

    const role = (roleEl ? roleEl.value : null) || 'dealer';
    const selectedClass = (classEl ? classEl.value : null) || '00';
    const minGrade = (gradeEl ? gradeEl.value : null) || '4'; // priority 기반 (4 = 전설(시즌0) 이상)

    // 카테고리별 룬 필터링
    // @updated 2025-12-10 - 카테고리 코드 수정 (02: 방어구, 04: 엠블럼)
    // @updated 2025-12-10 - 순서 변경: 방어구 먼저 (각성 쿨감 시너지), 장신구 중복 제한
    const categories = {
        '01': {
            count: 1,
            name: '무기 룬',
            slots: ['weapon-1']
        },
        '02': {
            count: 5,
            name: '방어구 룬',
            slots: ['armor-1', 'armor-2', 'armor-3', 'armor-4', 'armor-5']
        },
        '04': {
            count: 1,
            name: '엠블럼 룬',
            slots: ['emblem-1']
        },
        '03': {
            count: 3,
            name: '장신구 룬',
            slots: ['accessory-1', 'accessory-2', 'accessory-3']
        }
    };

    const recommendations = {};
    var totalAwakeningCooldownReduction = 0;

    // 처리 순서: 무기 -> 방어구 -> 엠블럼 -> 장신구
    var categoryOrder = ['01', '02', '04', '03'];

    categoryOrder.forEach(function(categoryCode) {
        var config = categories[categoryCode];

        // 해당 카테고리 룬 필터링
        // @updated 2025-12-10 - 새로운 등급 체계 기반 필터링
        var categoryRunes = state.allRunes.filter(function(rune) {
            // 카테고리 필터
            if (rune.category !== categoryCode) return false;

            // 등급 필터 (priority 기반)
            if (minGrade !== 'all') {
                var gradeInfo = getGradeInfo(rune);
                var minPriority = parseInt(minGrade) || 5;
                if (!gradeInfo || gradeInfo.priority > minPriority) return false;
            }

            // 클래스 필터
            if (selectedClass !== '00') {
                if (rune.klass !== selectedClass && rune.klass !== '00') return false;
            }

            return true;
        });

        // 점수 계산 (엠블럼은 각성 쿨감 시너지 적용)
        var cooldownReduction = (categoryCode === '04') ? totalAwakeningCooldownReduction : 0;

        categoryRunes = categoryRunes.map(function(rune) {
            var newRune = {};
            for (var key in rune) {
                newRune[key] = rune[key];
            }
            newRune.score = calculateRuneScore(rune, stats, role, cooldownReduction);
            return newRune;
        }).sort(function(a, b) {
            return b.score - a.score;
        });

        // 장신구: 동일 스킬 중복 제한 적용
        // @added 2025-12-10
        var selectedRunes = [];
        if (categoryCode === '03') {
            for (var i = 0; i < categoryRunes.length && selectedRunes.length < config.count; i++) {
                var candidateRune = categoryRunes[i];

                // 동일 스킬 룬인지 체크
                if (!isDuplicateSkillRune(selectedRunes, candidateRune)) {
                    selectedRunes.push(candidateRune);
                }
            }
        } else {
            // 다른 카테고리는 상위 N개 선택
            selectedRunes = categoryRunes.slice(0, config.count);
        }

        recommendations[categoryCode] = {
            count: config.count,
            name: config.name,
            slots: config.slots,
            runes: selectedRunes
        };

        // 방어구 선택 후 각성 쿨타임 감소량 계산
        if (categoryCode === '02') {
            selectedRunes.forEach(function(rune) {
                totalAwakeningCooldownReduction += parseAwakeningCooldownReduction(rune);
            });
        }
    });

    renderRecommendations(recommendations);
}

/**
 * 추천 결과 렌더링
 * @param {Object} recommendations - 추천 결과
 * @updated 2025-12-10 - 상세 효과 분석 정보 표시
 */
function renderRecommendations(recommendations) {
    const emptyEl = $('#recommend-empty');
    const slotsEl = $('#recommend-slots');
    const applyEl = $('#recommend-apply');

    if (!slotsEl) return;

    // 빈 상태 숨기기
    if (emptyEl) emptyEl.style.display = 'none';
    slotsEl.style.display = 'block';
    if (applyEl) applyEl.style.display = 'block';

    let html = '';

    Object.entries(recommendations).forEach(([categoryCode, data]) => {
        html += `
            <div class="recommend-slot-group" data-category="${categoryCode}">
                <h4 class="recommend-slot-group__title">${data.name} (${data.count}개)</h4>
        `;

        if (data.runes.length === 0) {
            html += `<p class="effect-empty">추천할 룬이 없습니다</p>`;
        } else {
            data.runes.forEach((rune, index) => {
                // 고급 효과 분석 사용
                const efficiency = calculateRuneEfficiencyScore(rune, 15, []);

                // DPS 핵심 효과만 우선 정렬하여 표시
                // @updated 2025-12-10 - 핵심 DPS 효과만 표시
                const effectEntries = Object.entries(efficiency.effectiveSummary)
                    .filter(([name, data]) => data.isCoreDPS) // 핵심 DPS 효과만
                    .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
                    .slice(0, 4); // 최대 4개

                const effectHtml = effectEntries.map(([name, data]) => {
                    const sign = data.total >= 0 ? '+' : '';
                    // DPS 핵심 효과는 ⚡ 아이콘
                    const typeIcon = '⚡';
                    return `<span class="effect-tag effect-tag--core" title="DPS 핵심 효과">${typeIcon} ${name} ${sign}${data.total.toFixed(1)}%</span>`;
                }).join(' ');

                // 등급 정보
                const gradeInfo = getGradeInfo(rune);
                const gradeName = gradeInfo ? gradeInfo.name : '??';

                html += `
                    <div class="recommend-rune-item" data-rune-id="${rune.id}" data-slot="${data.slots[index]}">
                        <img class="recommend-rune-item__image" 
                             src="${rune.image || 'https://via.placeholder.com/48'}" 
                             alt="${escapeHtml(rune.name)}"
                             onerror="this.src='https://via.placeholder.com/48?text=No'">
                        <div class="recommend-rune-item__info">
                            <div class="recommend-rune-item__name">
                                ${escapeHtml(rune.name)}
                                <span class="recommend-rune-item__grade">[${gradeName}]</span>
                            </div>
                            <div class="recommend-rune-item__effect">${effectHtml || '효과 분석 불가'}</div>
                            ${efficiency.dotTypes.length > 0 ? 
                                `<div class="recommend-rune-item__synergy">🔗 시너지: ${efficiency.dotTypes.join(', ')}</div>` : ''}
                        </div>
                        <div class="recommend-rune-item__score">
                            <span class="recommend-rune-item__score-label">효율 점수</span>
                            <span class="recommend-rune-item__score-value">${rune.score.toFixed(0)}</span>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
    });

    slotsEl.innerHTML = html;

    // 추천 결과를 state에 저장
    state.lastRecommendations = recommendations;

    showToast('최적 룬 조합이 계산되었습니다!', 'success');
}

/**
 * 추천 결과를 시뮬레이터에 적용
 */
function applyRecommendations() {
    if (!state.lastRecommendations) {
        showToast('추천 결과가 없습니다.', 'error');
        return;
    }

    // 기존 슬롯 초기화
    state.equippedRunes = {};

    // 추천 룬 장착
    Object.values(state.lastRecommendations).forEach(data => {
        data.runes.forEach((rune, index) => {
            const slotId = data.slots[index];
            if (slotId) {
                state.equippedRunes[slotId] = rune;
            }
        });
    });

    // 슬롯 렌더링
    Object.keys(SLOT_CONFIG).forEach(slotId => renderSlot(slotId));
    calculateTotalEffects();
    renderEquippedRuneList();
    saveEquippedRunes();

    // 시뮬레이터 탭으로 이동
    switchTab('simulator');

    showToast('추천 룬이 시뮬레이터에 적용되었습니다!', 'success');
}

/**
 * 스텟 입력 초기화
 * @updated 2025-12-11 - LocalStorage 저장된 스탯도 함께 초기화
 */
function resetStats() {
    const statInputs = $$('.stat-input__field');
    statInputs.forEach(input => {
        input.value = '';
    });

    // LocalStorage에 저장된 캐릭터 스탯 초기화 @added 2025-12-11
    saveToStorage(STORAGE_KEYS.CHARACTER_STATS, {});

    // 추천 결과 초기화
    const emptyEl = $('#recommend-empty');
    const slotsEl = $('#recommend-slots');
    const applyEl = $('#recommend-apply');

    if (emptyEl) emptyEl.style.display = 'flex';
    if (slotsEl) slotsEl.style.display = 'none';
    if (applyEl) applyEl.style.display = 'none';

    showToast('스텟이 초기화되었습니다.', 'success');
}

// ============================================

    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * Recommendation 전역 객체
     * @global
     */
    window.Recommendation = {
        runRecommendation: typeof runRecommendation !== 'undefined' ? runRecommendation : null,
        applyRecommendations: typeof applyRecommendations !== 'undefined' ? applyRecommendations : null,
        resetStats: typeof resetStats !== 'undefined' ? resetStats : null
    };

    console.log('✅ Recommendation 모듈 로드 완료');

})();
