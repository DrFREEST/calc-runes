/**
 * ============================================
 * 마비노기 모바일 룬 효율 계산기 - 메인 JavaScript
 * ============================================
 * @file        rune-calculator.js
 * @description 룬 데이터 로딩, 필터링, 시뮬레이션, 추천 기능 구현
 * @author      Dalkong Project
 * @created     2025-12-10
 * @modified    2025-12-11
 * @version     1.4.0
 * 
 * @changelog
 * - v1.4.0 (2025-12-11): 중복 코드 제거 및 모듈 완전 분리
 *   - 효과 파싱 엔진 → modules/effect-parser.js (2,300줄 분리)
 *   - 효과 합산 → modules/effect-calculator.js (350줄 분리)
 *   - 추천 시스템 → modules/recommendation.js (375줄 분리)
 *   - 파일 크기: 5,101줄 → 2,283줄 (55% 감소)
 * - v1.3.0 (2025-12-11): 모듈 분할 구조 적용
 *   - constants/effect-types.js: 효과 유형 상수
 *   - modules/utils.js: 유틸리티 함수
 *   - modules/storage-manager.js: LocalStorage 관리
 *   - modules/ui-manager.js: UI 관리 (토스트/모달/탭)
 *   - modules/data-loader.js: 데이터 로딩
 *   - modules/character-manager.js: 캐릭터 프로필 관리
 * - v1.2.0 (2025-12-11): 캐릭터 프로필 관리 시스템 추가
 * - v1.1.0 (2025-12-11): 데이터 영속화 기능 추가
 * 
 * @architecture
 * - 모듈 패턴 사용 (IIFE)
 * - 이벤트 위임 패턴 활용
 * - LocalStorage를 통한 데이터 영속화
 * 
 * @requires EffectTypes (constants/effect-types.js) - 효과 유형 상수
 * @requires Utils (modules/utils.js) - 유틸리티 함수
 * @requires StorageManager (modules/storage-manager.js) - LocalStorage 관리
 * @requires UIManager (modules/ui-manager.js) - UI 관리
 * @requires DataLoader (modules/data-loader.js) - 데이터 로딩
 * @requires EffectParser (modules/effect-parser.js) - 효과 파싱 엔진 [필수]
 * @requires EffectCalculator (modules/effect-calculator.js) - 효과 합산 [필수]
 * @requires Recommendation (modules/recommendation.js) - 추천 시스템 [필수]
 * @requires CharacterManager (modules/character-manager.js) - 캐릭터 관리
 * 
 * @structure (2,283줄)
 * 1. 외부 모듈 참조 및 상수 정의
 * 2. 전역 상태 (State)
 * 3. 유틸리티 함수 → modules/utils.js
 * 4. 데이터 로딩 → modules/data-loader.js
 * 5. 필터링/검색 (Filtering)
 * 6. 룬 카드 렌더링 (Rendering)
 * 7. 페이지네이션 (Pagination)
 * 8. 슬롯 관리 (Slot Management)
 * 9. 효과 파싱 엔진 → modules/effect-parser.js
 * 10. 효과 합산 → modules/effect-calculator.js
 * 11. 추천 시스템 → modules/recommendation.js
 * 12. 즐겨찾기 (Favorites)
 * 13. 모달 관리 → modules/ui-manager.js
 * 14. 프리셋 관리 (Presets)
 * 15. 토스트/탭 → modules/ui-manager.js
 * 16. 이벤트 핸들러 (Event Handlers)
 * 17. 초기화 (Initialization)
 * 18. 전역 인터페이스 (Global Interface)
 * 
 * @note 모듈 완전 분리 완료 (2025-12-11):
 * - 효과 파싱/합산/추천 기능은 각 모듈에서 필수 로드
 * - 모듈 로드 실패 시 경고 메시지 출력
 * - 메인 파일은 UI/이벤트/초기화 로직만 담당
 */

(function() {
    'use strict';

    // ============================================
    // 1. 외부 모듈 참조 및 상수 정의
    // ============================================
    // @updated 2025-12-11 - 모듈에서 상수 가져오기

    /**
     * 외부 모듈 참조
     * @description EffectTypes, Utils, StorageManager, UIManager 등
     */
    const ET = window.EffectTypes || {};
    const Utils = window.Utils || {};
    const SM = window.StorageManager || {};
    const UI = window.UIManager || {};
    const DP = window.DataLoader || {};
    const EP = window.EffectParser || {};

    /**
     * 카테고리 코드 매핑 (모듈에서 가져오거나 기본값 사용)
     * @constant {Object}
     */
    const CATEGORY_MAP = ET.CATEGORY_MAP || {
        '01': '무기',
        '02': '방어구',
        '03': '장신구',
        '04': '엠블럼'
    };

    /**
     * 등급 매핑 (모듈에서 가져오거나 기본값 사용)
     * @constant {Object}
     */
    const GRADE_MAP = ET.GRADE_MAP || {
        '신화': { name: '신화', color: '#FFD700', priority: 1 },
        '전설(시즌1)': { name: '전설(시즌1)', color: '#FF8C00', priority: 2 }
    };

    /**
     * 룬의 등급명 반환
     * @param {Object} rune - 룬 데이터
     * @returns {string} 등급명
     * @updated 2025-12-11 - 수동 파싱 데이터에서는 gradeName 직접 사용
     */
    function getGradeName(rune) {
        return rune.gradeName || '기타';
    }

    /**
     * 룬이 유효한 등급인지 확인
     * @param {Object} rune - 룬 데이터
     * @returns {boolean} 유효 여부
     * @updated 2025-12-11 - gradeName 기반 확인
     */
    function isValidGrade(rune) {
        const gradeName = getGradeName(rune);
        return GRADE_MAP.hasOwnProperty(gradeName);
    }

    /**
     * 룬의 등급 정보 반환
     * @param {Object} rune - 룬 데이터
     * @returns {Object|null} 등급 정보
     * @updated 2025-12-11 - gradeName 기반 조회
     */
    function getGradeInfo(rune) {
        const gradeName = getGradeName(rune);
        return GRADE_MAP[gradeName] || {
            name: gradeName,
            color: rune.gradeColor || '#888',
            priority: 99
        };
    }

    // ============================================
    // 1.1 외부 모듈 참조 (2025-12-11 추가)
    // ============================================

    /**
     * 외부 모듈 참조
     * @description 클래스 스텟, 효과 가중치, 계산 공식, 효율 계산기 모듈 참조
     * @requires class-stats.js
     * @requires effect-weights.js
     * @requires stat-formulas.js
     * @requires efficiency-calculator.js
     */
    const Modules = {
        /** 클래스별 스텟 정보 */
        ClassStats: window.ClassStats || null,
        /** 효과 가중치 상수 */
        EffectWeights: window.EffectWeights || null,
        /** 능력치 계산 공식 */
        StatFormulas: window.StatFormulas || null,
        /** 효율 점수 계산기 */
        EfficiencyCalculator: window.EfficiencyCalculator || null
    };

    /**
     * 모듈 로드 확인
     * @returns {boolean} 모든 모듈이 로드되었는지 여부
     */
    function areModulesLoaded() {
        return !!(Modules.ClassStats && Modules.EffectWeights &&
            Modules.StatFormulas && Modules.EfficiencyCalculator);
    }

    /**
     * 현재 캐릭터 스텟 상태
     * @type {Object|null}
     */
    let currentCharacterStats = null;

    /**
     * 캐릭터 스텟 초기화
     * @param {string} className - 클래스명
     * @returns {Object} CharacterStats 인스턴스
     */
    function initCharacterStats(className) {
        if (!Modules.EfficiencyCalculator) {
            console.warn('EfficiencyCalculator 모듈이 로드되지 않았습니다.');
            return null;
        }

        currentCharacterStats = new Modules.EfficiencyCalculator.CharacterStats({
            className: className || '전사'
        });

        return currentCharacterStats;
    }

    /**
     * 캐릭터 스텟 업데이트
     * @param {Object} stats - 업데이트할 스텟 값
     */
    function updateCharacterStats(stats) {
        if (!currentCharacterStats) {
            initCharacterStats(stats.className);
        }

        Object.assign(currentCharacterStats, stats);
    }

    /**
     * 룬 효율 점수 계산 (새 모듈 사용)
     * @param {Object} rune - 룬 데이터
     * @param {number} [enhanceLevel=0] - 강화 단계
     * @returns {Object} 효율 점수 결과
     */
    function calculateRuneEfficiencyScore(rune, enhanceLevel) {
        enhanceLevel = enhanceLevel || 0;

        if (!Modules.EfficiencyCalculator || !currentCharacterStats) {
            return {
                score: 0,
                breakdown: null
            };
        }

        return Modules.EfficiencyCalculator.calculateRuneEfficiency(
            rune,
            currentCharacterStats,
            enhanceLevel
        );
    }

    /**
     * 룬 조합 효율 계산 (새 모듈 사용)
     * @param {Array<Object>} equippedRunes - 장착된 룬 배열
     * @param {Object} [enhanceLevels={}] - 룬별 강화 단계
     * @returns {Object} 조합 효율 결과
     */
    function calculateCombinationEfficiencyScore(equippedRunes, enhanceLevels) {
        enhanceLevels = enhanceLevels || {};

        if (!Modules.EfficiencyCalculator || !currentCharacterStats) {
            return {
                totalScore: 0,
                runeScores: [],
                synergyBonus: 0,
                synergyDetails: []
            };
        }

        return Modules.EfficiencyCalculator.calculateCombinationEfficiency(
            equippedRunes,
            currentCharacterStats,
            enhanceLevels
        );
    }

    /**
     * 클래스 코드 매핑
     * @constant {Object}
     */
    const CLASS_MAP = {
        '00': '전체',
        '01': '전사 (검과 방패)',
        '02': '검술사 (양손검)',
        '03': '대검전사 (대검)',
        '04': '궁수 (활)',
        '05': '석궁사수 (석궁)',
        '06': '장궁병 (장궁)',
        '07': '마법사 (완드)',
        '08': '화염술사 (파이어 오브)',
        '09': '빙결술사 (아이스 오브)',
        '10': '힐러 (힐링 완드)',
        '11': '사제 (힐링 스태프)',
        '12': '수도사 (쿼터 스태프)',
        '13': '음유시인 (류트)',
        '14': '댄서 (부채)',
        '15': '악사 (하프)',
        '16': '도적 (단검)',
        '17': '격투가 (너클)',
        '18': '듀얼블레이드 (듀얼 소드)',
        '19': '암흑술사 (케인)',
        '20': '전격술사 (라이트닝 오브)',
        '21': '클래스21',
        '22': '클래스22',
        '23': '클래스23',
        '24': '클래스24'
    };

    /**
     * 슬롯 설정
     * @constant {Object}
     * @updated 2025-12-10 - 카테고리 코드 수정 (방어구: 02, 엠블럼: 04)
     */
    const SLOT_CONFIG = {
        'weapon-1': {
            category: '01',
            name: '무기'
        },
        'emblem-1': {
            category: '04',
            name: '엠블럼'
        },
        'accessory-1': {
            category: '03',
            name: '장신구 1'
        },
        'accessory-2': {
            category: '03',
            name: '장신구 2'
        },
        'accessory-3': {
            category: '03',
            name: '장신구 3'
        },
        'armor-1': {
            category: '02',
            name: '방어구 1'
        },
        'armor-2': {
            category: '02',
            name: '방어구 2'
        },
        'armor-3': {
            category: '02',
            name: '방어구 3'
        },
        'armor-4': {
            category: '02',
            name: '방어구 4'
        },
        'armor-5': {
            category: '02',
            name: '방어구 5'
        }
    };

    /**
     * 페이지당 표시할 룬 개수
     * @constant {number}
     */
    const ITEMS_PER_PAGE = 20;

    /**
     * LocalStorage 키
     * @constant {Object}
     * @updated 2025-12-11 - CHARACTER_STATS, RECOMMEND_OPTIONS, ENHANCE_LEVELS 키 추가
     */
    const STORAGE_KEYS = {
        FAVORITES: 'mabinogi_rune_favorites',
        PRESETS: 'mabinogi_rune_presets',
        EQUIPPED_RUNES: 'mabinogi_rune_equipped',
        CHARACTER_STATS: 'mabinogi_rune_character_stats',
        RECOMMEND_OPTIONS: 'mabinogi_rune_recommend_options',
        ENHANCE_LEVELS: 'mabinogi_rune_enhance_levels'
    };

    // ============================================
    // 2. 전역 상태 (State)
    // ============================================

    /**
     * 애플리케이션 상태
     * @type {Object}
     */
    const state = {
        /** @type {Array} 전체 룬 데이터 */
        allRunes: [],
        /** @type {Array} 필터링된 룬 데이터 */
        filteredRunes: [],
        /** @type {number} 현재 페이지 번호 */
        currentPage: 1,
        /** @type {Object} 현재 필터 조건 */
        filters: {
            search: '',
            category: 'all',
            grade: 'all',
            klass: 'all'
        },
        /** @type {Object} 장착된 룬 (슬롯ID: 룬객체) */
        equippedRunes: {},
        /** @type {Array} 즐겨찾기한 룬 ID 목록 */
        favorites: [],
        /** @type {Array} 저장된 프리셋 목록 */
        presets: [],
        /** @type {string|null} 현재 선택된 슬롯 (모달용) */
        selectedSlot: null,
        /** @type {number} 현재 강화 단계 (0, 10, 15) - 일괄 적용용 */
        enhanceLevel: 0,
        /** @type {Object} 슬롯별 개별 강화 단계 @added 2025-12-10 */
        enhanceLevels: {}
    };

    // ============================================
    // 3. 유틸리티 함수 (Utilities)
    // ============================================
    // @updated 2025-12-11 - 모듈 참조 방식으로 변경

    /**
     * DOM 요소 선택 헬퍼 (Utils 모듈 사용)
     */
    const $ = Utils.$ || function(selector) {
        return document.querySelector(selector);
    };

    /**
     * 다중 DOM 요소 선택 헬퍼 (Utils 모듈 사용)
     */
    const $$ = Utils.$$ || function(selector) {
        return document.querySelectorAll(selector);
    };

    /**
     * HTML 특수문자 이스케이프 (Utils 모듈 사용)
     */
    const escapeHtml = Utils.escapeHtml || function(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * HTML 태그 제거 (Utils 모듈 사용)
     */
    const stripHtml = Utils.stripHtml || function(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    };

    /**
     * 디바운스 함수 (Utils 모듈 사용)
     */
    const debounce = Utils.debounce || function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    /**
     * LocalStorage에서 데이터 로드 (StorageManager 모듈 사용)
     */
    const loadFromStorage = SM.load || function(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('LocalStorage 로드 오류:', e);
            return defaultValue;
        }
    };

    /**
     * LocalStorage에 데이터 저장 (StorageManager 모듈 사용)
     */
    const saveToStorage = SM.save || function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('LocalStorage 저장 오류:', e);
        }
    };

    // ============================================
    // 4. 데이터 로딩 (Data Loading)
    // ============================================

    /**
     * 룬 데이터 JSON 파일 로드
     * @async
     * @returns {Promise<void>}
     * @updated 2025-12-11 - 수동 파싱된 4개 JSON 파일 로드 (무기/방어구/장신구/엠블럼)
     */
    async function loadRuneData() {
        try {
            // 4개의 분리된 JSON 파일 병렬 로드
            const [weaponRes, armorRes, accessoryRes, emblemRes] = await Promise.all([
                fetch('runes-weapon.json'),
                fetch('runes-armor.json'),
                fetch('runes-accessory.json'),
                fetch('runes-emblem.json')
            ]);

            // 응답 확인
            if (!weaponRes.ok) throw new Error(`무기 룬 로드 실패: ${weaponRes.status}`);
            if (!armorRes.ok) throw new Error(`방어구 룬 로드 실패: ${armorRes.status}`);
            if (!accessoryRes.ok) throw new Error(`장신구 룬 로드 실패: ${accessoryRes.status}`);
            if (!emblemRes.ok) throw new Error(`엠블럼 룬 로드 실패: ${emblemRes.status}`);

            // JSON 파싱
            const weaponData = await weaponRes.json();
            const armorData = await armorRes.json();
            const accessoryData = await accessoryRes.json();
            const emblemData = await emblemRes.json();

            // 무기 룬은 { runes: [...] } 형태, 나머지는 배열
            const weaponRunes = weaponData.runes || weaponData;
            const armorRunes = armorData;
            const accessoryRunes = accessoryData;
            const emblemRunes = emblemData;

            // 전체 룬 병합
            const allRunes = [
                ...weaponRunes,
                ...armorRunes,
                ...accessoryRunes,
                ...emblemRunes
            ];

            state.allRunes = allRunes;
            state.filteredRunes = [...allRunes];

            // 카테고리별 통계 출력
            const categoryStats = {
                '무기': weaponRunes.length,
                '방어구': armorRunes.length,
                '장신구': accessoryRunes.length,
                '엠블럼': emblemRunes.length
            };
            console.log(`✅ 룬 데이터 로드 완료: 총 ${allRunes.length}개`);
            console.log('📊 카테고리별 룬 수:', categoryStats);

            // 등급별 통계 출력
            const gradeStats = {};
            allRunes.forEach(rune => {
                const gradeName = rune.gradeName || '기타';
                gradeStats[gradeName] = (gradeStats[gradeName] || 0) + 1;
            });
            console.log('📊 등급별 룬 수:', gradeStats);

            // 초기 렌더링
            renderRuneList();
            updateFilterCount();

        } catch (error) {
            console.error('❌ 룬 데이터 로드 실패:', error);
            showToast('룬 데이터를 불러오는데 실패했습니다.', 'error');

            // 에러 메시지 표시
            const grid = $('#rune-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="loading-indicator">
                        <p style="color: var(--color-accent-danger);">
                            ❌ 데이터 로드 실패<br>
                            <small>${error.message}</small>
                        </p>
                    </div>
                `;
            }
        }
    }

    // ============================================
    // 5. 필터링/검색 (Filtering)
    // ============================================

    /**
     * 룬 데이터 필터링
     * @description 현재 필터 조건에 따라 룬 목록 필터링
     * @updated 2025-12-11 - 수동 파싱 데이터 구조에 맞게 수정 (gradeName, rawDescription 사용)
     */
    function filterRunes() {
        const {
            search,
            category,
            grade,
            klass
        } = state.filters;

        state.filteredRunes = state.allRunes.filter(rune => {
            // 검색어 필터
            if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = rune.name && rune.name.toLowerCase().includes(searchLower);
                // 수동 파싱 데이터에서는 rawDescription 사용
                const desc = rune.rawDescription || rune.description || '';
                const descMatch = desc.toLowerCase().includes(searchLower);
                if (!nameMatch && !descMatch) return false;
            }

            // 카테고리 필터
            if (category !== 'all' && rune.category !== category) {
                return false;
            }

            // 등급 필터 (gradeName 직접 비교)
            if (grade !== 'all') {
                const gradeName = getGradeName(rune);
                if (gradeName !== grade) {
                    return false;
                }
            }

            // 클래스 필터 (수동 파싱 데이터에서는 classRestriction 사용)
            if (klass !== 'all') {
                const runeClass = rune.classRestriction || rune.klass || null;
                // 클래스 제한이 없는 룬은 모든 클래스에서 사용 가능
                if (runeClass && runeClass !== klass && runeClass !== '00') {
                    return false;
                }
            }

            return true;
        });

        // 등급 우선순위 정렬 (신화 > 전설(시즌1) > 전설(시즌0) > 유니크)
        state.filteredRunes.sort((a, b) => {
            const gradeInfoA = getGradeInfo(a);
            const gradeInfoB = getGradeInfo(b);
            const priorityA = gradeInfoA ? gradeInfoA.priority : 999;
            const priorityB = gradeInfoB ? gradeInfoB.priority : 999;
            return priorityA - priorityB;
        });

        // 페이지 초기화 및 렌더링
        state.currentPage = 1;
        renderRuneList();
        renderPagination();
        updateFilterCount();
    }

    /**
     * 필터 조건 업데이트 및 적용
     * @param {string} filterType - 필터 종류
     * @param {string} value - 필터 값
     */
    function updateFilter(filterType, value) {
        state.filters[filterType] = value;
        filterRunes();
    }

    /**
     * 필터 결과 개수 업데이트
     */
    function updateFilterCount() {
        const countEl = $('#filter-result-count');
        if (countEl) {
            countEl.textContent = state.filteredRunes.length;
        }
    }

    /**
     * 필터 초기화
     */
    function resetFilters() {
        state.filters = {
            search: '',
            category: 'all',
            grade: 'all',
            klass: 'all'
        };

        // 입력 필드 초기화
        const searchInput = $('#search-input');
        const categorySelect = $('#filter-category');
        const gradeSelect = $('#filter-grade');
        const classSelect = $('#filter-class');

        if (searchInput) searchInput.value = '';
        if (categorySelect) categorySelect.value = 'all';
        if (gradeSelect) gradeSelect.value = 'all';
        if (classSelect) classSelect.value = 'all';

        filterRunes();
        showToast('필터가 초기화되었습니다.', 'success');
    }

    // ============================================
    // 6. 룬 카드 렌더링 (Rendering)
    // ============================================

    /**
     * 룬 목록 렌더링
     * @description 현재 페이지의 룬 카드를 그리드에 렌더링
     */
    function renderRuneList() {
        const grid = $('#rune-grid');
        if (!grid) return;

        const startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageRunes = state.filteredRunes.slice(startIndex, endIndex);

        if (pageRunes.length === 0) {
            grid.innerHTML = `
                <div class="loading-indicator">
                    <p>검색 결과가 없습니다.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = pageRunes.map(rune => createRuneCard(rune)).join('');
    }

    /**
     * 룬 카드 HTML 생성
     * @param {Object} rune - 룬 데이터
     * @returns {string} HTML 문자열
     * @updated 2025-12-11 - 수동 파싱 데이터 구조에 맞게 수정
     */
    function createRuneCard(rune) {
        // 수동 파싱 데이터에서는 gradeName, gradeColor, categoryName 직접 사용
        const gradeName = rune.gradeName || '기타';
        const gradeColor = rune.gradeColor || '#888';
        const categoryName = rune.categoryName || CATEGORY_MAP[rune.category] || '기타';
        const isFavorite = state.favorites.includes(rune.id);

        // 설명: rawDescription (수동 파싱) 또는 description (원본)
        const description = rune.rawDescription || stripHtml(rune.description) || '설명 없음';

        // 등급별 카드 클래스
        const gradeClass = gradeName === '신화' ? 'rune-card--grade-myth' :
            gradeName === '전설(시즌1)' ? 'rune-card--grade-legend-s1' :
            gradeName.includes('전설') ? 'rune-card--grade-legend' :
            gradeName.includes('유니크') ? 'rune-card--grade-unique' : '';

        // 스킬 변경 룬 표시 (장신구)
        const isSkillChange = rune.type === 'SKILL_CHANGE';
        const skillChangeLabel = isSkillChange ? '<span class="rune-card__badge rune-card__badge--skill">스킬변경</span>' : '';

        return `
            <div class="rune-card ${gradeClass}" data-rune-id="${rune.id}">
                <div class="rune-card__header">
                    <img class="rune-card__image" 
                         src="${rune.image || 'images/runes/rune_common.png'}" 
                         alt="${escapeHtml(rune.name)}"
                         onerror="this.src='images/runes/rune_common.png'">
                    <div class="rune-card__info">
                        <div class="rune-card__name">${escapeHtml(rune.name)}</div>
                        <div class="rune-card__meta">
                            <span class="rune-card__badge rune-card__badge--grade" style="background-color: ${gradeColor}">${gradeName}</span>
                            <span class="rune-card__badge rune-card__badge--category">${categoryName}</span>
                            ${skillChangeLabel}
                        </div>
                    </div>
                </div>
                <div class="rune-card__description">${escapeHtml(description.substring(0, 100))}${description.length > 100 ? '...' : ''}</div>
                <div class="rune-card__actions">
                    <button class="rune-card__btn rune-card__btn--favorite ${isFavorite ? 'active' : ''}" 
                            data-action="favorite" 
                            data-rune-id="${rune.id}"
                            title="즐겨찾기">
                        ${isFavorite ? '⭐' : '☆'}
                    </button>
                    <button class="rune-card__btn rune-card__btn--equip" 
                            data-action="detail" 
                            data-rune-id="${rune.id}"
                            title="상세보기">
                        🔍 상세
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // 7. 페이지네이션 (Pagination)
    // ============================================

    /**
     * 페이지네이션 렌더링
     */
    function renderPagination() {
        const paginationEl = $('#pagination');
        if (!paginationEl) return;

        const totalPages = Math.ceil(state.filteredRunes.length / ITEMS_PER_PAGE);

        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '';

        // 이전 버튼
        html += `
            <button class="pagination__btn" data-page="prev" ${state.currentPage === 1 ? 'disabled' : ''}>
                ◀
            </button>
        `;

        // 페이지 번호
        const maxVisible = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button class="pagination__btn" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span class="pagination__dots">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="pagination__btn ${i === state.currentPage ? 'pagination__btn--active' : ''}" 
                        data-page="${i}">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span class="pagination__dots">...</span>`;
            }
            html += `<button class="pagination__btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // 다음 버튼
        html += `
            <button class="pagination__btn" data-page="next" ${state.currentPage === totalPages ? 'disabled' : ''}>
                ▶
            </button>
        `;

        paginationEl.innerHTML = html;
    }

    /**
     * 페이지 변경
     * @param {number|string} page - 페이지 번호 또는 'prev'/'next'
     */
    function changePage(page) {
        const totalPages = Math.ceil(state.filteredRunes.length / ITEMS_PER_PAGE);

        if (page === 'prev') {
            state.currentPage = Math.max(1, state.currentPage - 1);
        } else if (page === 'next') {
            state.currentPage = Math.min(totalPages, state.currentPage + 1);
        } else {
            state.currentPage = parseInt(page);
        }

        renderRuneList();
        renderPagination();

        // 스크롤 위로
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // ============================================
    // 8. 슬롯 관리 (Slot Management)
    // ============================================

    /**
     * 슬롯에 룬 장착
     * @param {string} slotId - 슬롯 ID
     * @param {Object} rune - 장착할 룬
     */
    function equipRune(slotId, rune) {
        state.equippedRunes[slotId] = rune;
        renderSlot(slotId);
        calculateTotalEffects();
        renderEquippedRuneList();
        saveEquippedRunes();
        showToast(`"${rune.name}" 룬을 장착했습니다.`, 'success');
    }

    /**
     * 슬롯에서 룬 해제
     * @param {string} slotId - 슬롯 ID
     */
    function unequipRune(slotId) {
        const rune = state.equippedRunes[slotId];
        if (rune) {
            delete state.equippedRunes[slotId];
            renderSlot(slotId);
            calculateTotalEffects();
            renderEquippedRuneList();
            saveEquippedRunes();
            showToast(`"${rune.name}" 룬을 해제했습니다.`, 'success');
        }
    }

    /**
     * 모든 슬롯 초기화
     */
    function clearAllSlots() {
        state.equippedRunes = {};
        Object.keys(SLOT_CONFIG).forEach(slotId => renderSlot(slotId));
        calculateTotalEffects();
        renderEquippedRuneList();
        saveEquippedRunes();
        showToast('모든 슬롯이 초기화되었습니다.', 'success');
    }

    /**
     * 단일 슬롯 렌더링
     * @param {string} slotId - 슬롯 ID
     * @updated 2025-12-10 - 개별 강화 수치 표시 추가
     */
    function renderSlot(slotId) {
        const slotEl = $(`.rune-slot[data-slot="${slotId}"]`);
        if (!slotEl) return;

        const rune = state.equippedRunes[slotId];
        const slotConfig = SLOT_CONFIG[slotId];
        const enhanceLevel = state.enhanceLevels[slotId] || 0;

        if (rune) {
            slotEl.classList.add('rune-slot--filled');
            // 강화 수치에 따른 클래스 추가
            slotEl.classList.remove('rune-slot--enhance10', 'rune-slot--enhance15');
            if (enhanceLevel >= 15) {
                slotEl.classList.add('rune-slot--enhance15');
            } else if (enhanceLevel >= 10) {
                slotEl.classList.add('rune-slot--enhance10');
            }

            const enhanceBadge = enhanceLevel > 0 ?
                `<span class="rune-slot__enhance-badge">+${enhanceLevel}</span>` : '';

            slotEl.innerHTML = `
                <div class="rune-slot__content">
                    <img class="rune-slot__image" 
                         src="${rune.image || 'https://via.placeholder.com/48'}" 
                         alt="${escapeHtml(rune.name)}"
                         onerror="this.src='https://via.placeholder.com/48?text=No'">
                    <div class="rune-slot__name">${escapeHtml(rune.name)}</div>
                    ${enhanceBadge}
                </div>
                <button class="rune-slot__remove" data-action="unequip" data-slot="${slotId}">×</button>
            `;
        } else {
            slotEl.classList.remove('rune-slot--filled', 'rune-slot--enhance10', 'rune-slot--enhance15');
            slotEl.innerHTML = `
                <div class="rune-slot__empty">
                    <span class="rune-slot__plus">+</span>
                    <span class="rune-slot__label">${slotConfig.name}</span>
                </div>
            `;
        }
    }

    /**
     * 장착된 룬 저장
     */
    function saveEquippedRunes() {
        saveToStorage(STORAGE_KEYS.EQUIPPED_RUNES, state.equippedRunes);
    }

    /**
     * 장착된 룬 불러오기
     * @updated 2025-12-10 - 강화 수치도 함께 로드
     */
    function loadEquippedRunes() {
        const saved = loadFromStorage(STORAGE_KEYS.EQUIPPED_RUNES, {});
        state.equippedRunes = saved;

        // 강화 수치 불러오기 @added 2025-12-10
        loadEnhanceLevels();

        Object.keys(SLOT_CONFIG).forEach(slotId => renderSlot(slotId));
        calculateTotalEffects();
        renderEquippedRuneList();
    }

    /**
     * 장착된 룬 목록 렌더링
     * @updated 2025-12-10 - data-rune-id 추가 (클릭 시 상세정보 모달)
     * @updated 2025-12-10 - 개별 강화 수치 입력 추가
     */
    function renderEquippedRuneList() {
        const listEl = $('#equipped-runes-list');
        if (!listEl) return;

        const equippedList = Object.entries(state.equippedRunes);

        if (equippedList.length === 0) {
            listEl.innerHTML = '<p class="effect-empty">장착된 룬이 없습니다</p>';
            return;
        }

        listEl.innerHTML = equippedList.map(([slotId, rune]) => {
            const slotConfig = SLOT_CONFIG[slotId];
            const currentEnhance = state.enhanceLevels[slotId] || 0;
            return `
                <div class="equipped-rune-item" data-rune-id="${rune.id}" data-slot-id="${slotId}">
                    <img class="equipped-rune-item__image" 
                         src="${rune.image || 'https://via.placeholder.com/32'}" 
                         alt="${escapeHtml(rune.name)}"
                         onerror="this.src='https://via.placeholder.com/32?text=No'">
                    <div class="equipped-rune-item__info">
                        <div class="equipped-rune-item__name">${escapeHtml(rune.name)}</div>
                        <div class="equipped-rune-item__slot">${slotConfig.name}</div>
                    </div>
                    <div class="equipped-rune-item__enhance" onclick="event.stopPropagation()">
                        <select class="enhance-select" data-slot="${slotId}" title="강화 단계">
                            <option value="0" ${currentEnhance === 0 ? 'selected' : ''}>+0</option>
                            <option value="10" ${currentEnhance === 10 ? 'selected' : ''}>+10</option>
                            <option value="15" ${currentEnhance === 15 ? 'selected' : ''}>+15</option>
                        </select>
                    </div>
                </div>
            `;
        }).join('');

        // 강화 수치 변경 이벤트 바인딩
        listEl.querySelectorAll('.enhance-select').forEach(select => {
            select.addEventListener('change', function(e) {
                const slotId = this.dataset.slot;
                const enhanceLevel = parseInt(this.value);
                updateSlotEnhanceLevel(slotId, enhanceLevel);
            });
        });
    }

    /**
     * 슬롯 개별 강화 수치 업데이트
     * @param {string} slotId - 슬롯 ID
     * @param {number} enhanceLevel - 강화 단계 (0, 10, 15)
     * @added 2025-12-10
     */
    function updateSlotEnhanceLevel(slotId, enhanceLevel) {
        state.enhanceLevels[slotId] = enhanceLevel;
        saveEnhanceLevels();
        calculateTotalEffects();

        // 슬롯 UI 업데이트 (강화 수치 표시)
        renderSlot(slotId);
    }

    /**
     * 강화 수치 저장
     * @added 2025-12-10
     * @updated 2025-12-11 - STORAGE_KEYS 상수 사용
     */
    function saveEnhanceLevels() {
        saveToStorage(STORAGE_KEYS.ENHANCE_LEVELS, state.enhanceLevels);
    }

    /**
     * 강화 수치 불러오기
     * @added 2025-12-10
     * @updated 2025-12-11 - STORAGE_KEYS 상수 사용
     */
    function loadEnhanceLevels() {
        state.enhanceLevels = loadFromStorage(STORAGE_KEYS.ENHANCE_LEVELS, {});
    }

    // ============================================
    // 8.2 캐릭터 스탯 저장/불러오기 (2025-12-11 추가)
    // ============================================

    /**
     * 캐릭터 스탯 입력 필드 ID 목록
     * @constant {Array<string>}
     * @added 2025-12-11
     * @description 추천 시스템에서 사용하는 모든 스탯 입력 필드 ID
     */
    const CHARACTER_STAT_FIELDS = [
        // 5대 기본 스탯
        'stat-str', 'stat-dex', 'stat-int', 'stat-wil', 'stat-luk',
        // 주요 스탯
        'stat-atk', 'stat-def',
        // 세부 스탯
        'stat-break', 'stat-smash', 'stat-combo', 'stat-skill',
        'stat-aoe', 'stat-heal', 'stat-evade', 'stat-extra',
        'stat-dmgred', 'stat-atkspd', 'stat-chain', 'stat-skillspd',
        'stat-hp', 'stat-ult', 'stat-crit'
    ];

    /**
     * 추천 옵션 필드 ID 목록
     * @constant {Array<string>}
     * @added 2025-12-11
     * @description 추천 시스템에서 사용하는 옵션 선택 필드 ID
     */
    const RECOMMEND_OPTION_FIELDS = [
        'recommend-role',      // 역할군
        'recommend-class',     // 클래스
        'recommend-min-grade'  // 최소 등급
    ];

    /**
     * 캐릭터 스탯 저장
     * @description 입력된 캐릭터 스탯을 LocalStorage에 저장
     * @added 2025-12-11
     */
    function saveCharacterStats() {
        const stats = {};

        CHARACTER_STAT_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element) {
                // 숫자 필드이므로 값이 있으면 숫자로 저장, 없으면 빈 문자열 저장
                const value = element.value.trim();
                stats[fieldId] = value !== '' ? parseInt(value) || 0 : '';
            }
        });

        saveToStorage(STORAGE_KEYS.CHARACTER_STATS, stats);
    }

    /**
     * 캐릭터 스탯 불러오기
     * @description LocalStorage에서 저장된 캐릭터 스탯을 불러와 입력 필드에 적용
     * @added 2025-12-11
     */
    function loadCharacterStats() {
        const savedStats = loadFromStorage(STORAGE_KEYS.CHARACTER_STATS, {});

        // 저장된 데이터가 없으면 종료
        if (Object.keys(savedStats).length === 0) {
            return;
        }

        CHARACTER_STAT_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element && savedStats.hasOwnProperty(fieldId)) {
                // 빈 문자열이면 빈 값으로, 아니면 저장된 값 적용
                element.value = savedStats[fieldId] !== '' ? savedStats[fieldId] : '';
            }
        });

        console.log('📊 저장된 캐릭터 스탯 불러오기 완료');
    }

    /**
     * 추천 옵션 저장
     * @description 선택된 추천 옵션을 LocalStorage에 저장
     * @added 2025-12-11
     */
    function saveRecommendOptions() {
        const options = {};

        RECOMMEND_OPTION_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element) {
                options[fieldId] = element.value;
            }
        });

        saveToStorage(STORAGE_KEYS.RECOMMEND_OPTIONS, options);
    }

    /**
     * 추천 옵션 불러오기
     * @description LocalStorage에서 저장된 추천 옵션을 불러와 선택 필드에 적용
     * @added 2025-12-11
     */
    function loadRecommendOptions() {
        const savedOptions = loadFromStorage(STORAGE_KEYS.RECOMMEND_OPTIONS, {});

        // 저장된 데이터가 없으면 종료
        if (Object.keys(savedOptions).length === 0) {
            return;
        }

        RECOMMEND_OPTION_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element && savedOptions.hasOwnProperty(fieldId)) {
                element.value = savedOptions[fieldId];
            }
        });

        console.log('🎯 저장된 추천 옵션 불러오기 완료');
    }

    /**
     * 캐릭터 스탯 및 추천 옵션 초기화
     * @description 모든 스탯 입력 필드와 추천 옵션을 초기값으로 리셋하고 저장
     * @added 2025-12-11
     */
    function resetCharacterStatsAndOptions() {
        // 스탯 필드 초기화
        CHARACTER_STAT_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element) {
                element.value = '';
            }
        });

        // 저장된 스탯 삭제
        saveToStorage(STORAGE_KEYS.CHARACTER_STATS, {});

        // 추천 옵션은 초기화하지 않음 (사용자 의도에 따라 별도 처리)
        console.log('📊 캐릭터 스탯 초기화 완료');
    }

    /**
     * 모든 장착 슬롯에 강화 수치 일괄 적용
     * @param {number} enhanceLevel - 강화 단계 (0, 10, 15)
     * @added 2025-12-10
     */
    function applyEnhanceLevelToAll(enhanceLevel) {
        // 장착된 룬이 있는 슬롯에만 적용
        Object.keys(state.equippedRunes).forEach(slotId => {
            state.enhanceLevels[slotId] = enhanceLevel;
        });

        saveEnhanceLevels();

        // UI 업데이트
        Object.keys(state.equippedRunes).forEach(slotId => {
            renderSlot(slotId);
        });
        renderEquippedRuneList();
        calculateTotalEffects();

        showToast(`모든 장착 룬에 +${enhanceLevel} 강화 적용`, 'success');
    }


    // ============================================
    // 9. 효과 파싱 엔진 (EffectParser 모듈 참조)
    // ============================================
    // @updated 2025-12-11 - EffectParser 모듈로 완전 분리
    // @see modules/effect-parser.js

    /**
     * 효과 유형 상수 (EffectParser 모듈에서 가져오기)
     */
    const EFFECT_TYPE = EP.EFFECT_TYPE || ET.EFFECT_TYPE || {
        PASSIVE: 'passive', TRIGGER: 'trigger', STACKING: 'stacking',
        STATE_CONDITION: 'state', ENEMY_CONDITION: 'enemy', ENHANCEMENT: 'enhance'
    };

    const EFFECT_TYPE_WEIGHT = EP.EFFECT_TYPE_WEIGHT || ET.EFFECT_TYPE_WEIGHT || {
        passive: 1.0, trigger: 0.8, stacking: 0.95, state: 0.7, enemy: 0.5, enhance: 1.0
    };

    const EMBLEM_AWAKENING_BASE_COOLDOWN = EP.EMBLEM_AWAKENING_BASE_COOLDOWN || 90;

    /**
     * 엠블럼 각성 효과 파싱 (EffectParser 모듈 참조)
     */
    const parseEmblemAwakening = EP.parseEmblemAwakening || function(description) {
        console.warn('[EffectParser] 모듈이 로드되지 않았습니다.');
        return null;
    };

    /**
     * 효과 수치 파싱 (EffectParser 모듈 참조)
     */
    const parseEffectValues = EP.parseEffectValues || function(effectText) {
        console.warn('[EffectParser] 모듈이 로드되지 않았습니다.');
        return {};
    };

    /**
     * 각성 쿨타임 감소량 파싱 (EffectParser 모듈 참조)
     */
    const parseAwakeningCooldownReduction = EP.parseAwakeningCooldownReduction || function(rune) {
        return 0;
    };

    /**
     * 총 각성 쿨타임 감소량 계산
     */
    function getTotalAwakeningCooldownReduction() {
        var totalReduction = 0;
        Object.values(state.equippedRunes).forEach(function(rune) {
            if (rune) totalReduction += parseAwakeningCooldownReduction(rune);
        });
        return totalReduction;
    }

    /**
     * 각성 업타임 계산 (EffectParser 모듈 참조)
     */
    const calculateAwakeningUptime = EP.calculateAwakeningUptime || function(emblemRune, cooldownReduction) {
        return 0;
    };

    /**
     * 장신구 스킬명 추출 (EffectParser 모듈 참조)
     */
    const getAccessorySkillName = EP.getAccessorySkillName || function(rune) {
        return null;
    };

    /**
     * 중복 스킬 룬 체크 (EffectParser 모듈 참조)
     */
    const isDuplicateSkillRune = EP.isDuplicateSkillRune || function(selectedRunes, candidateRune) {
        return false;
    };

    /**
     * 룬 효과 파싱 (EffectParser 모듈 참조)
     */
    const parseRuneEffect = EP.parseRuneEffect || function(rune, enhanceLevel) {
        console.warn('[EffectParser] 모듈이 로드되지 않았습니다.');
        return { effects: {}, rawText: '' };
    };

    /**
     * 강화 효과 파싱 (EffectParser 모듈 참조)
     */
    const parseEnhanceEffect = EP.parseEnhanceEffect || function(rune, enhanceLevel) {
        return {};
    };

    /**
     * 시간 감소 효과 파싱 (EffectParser 모듈 참조)
     */
    const parseDecayEffect = EP.parseDecayEffect || function(text) {
        return null;
    };

    /**
     * 시너지 룬 체크 (EffectParser 모듈 참조)
     */
    const checkSynergyRunes = EP.checkSynergyRunes || function(equippedRunes) {
        return { hasSynergy: false, synergyTypes: [], bonusMultiplier: 1.0 };
    };

    /**
     * 도트 효과 파싱 (EffectParser 모듈 참조)
     */
    const parseDotEffect = EP.parseDotEffect || function(text) {
        return null;
    };

    /**
     * 장착된 모든 도트 타입 조회
     */
    function getAllEquippedDotTypes() {
        var dotTypes = [];
        Object.values(state.equippedRunes).forEach(function(rune) {
            if (rune && rune.description) {
                var dot = parseDotEffect(stripHtml(rune.description));
                if (dot && dot.type) dotTypes.push(dot.type);
            }
        });
        return dotTypes;
    }


    /**
     * 슬롯용 효율 계산 (EffectParser 모듈 참조)
     */
    const calculateEfficiencyForSlot = EP.calculateEfficiencyForSlot || function(rune, enhanceLevel) {
        return {};
    };

    // ============================================

    // ============================================
    // 10. 효과 합산 (EffectCalculator 모듈 참조)
    // ============================================
    // @updated 2025-12-11 - EffectCalculator 모듈로 완전 분리
    // @see modules/effect-calculator.js

    /**
     * 장착된 모든 룬의 효과 합산 (EffectCalculator 모듈 참조)
     * @returns {Object} 효과 합산 결과
     */
    function calculateTotalEffects() {
        // EffectCalculator 모듈 사용
        if (window.EffectCalculator && window.EffectCalculator.calculateTotalEffects) {
            return window.EffectCalculator.calculateTotalEffects();
        }
        
        // 폴백: 최소한의 계산
        console.warn('[EffectCalculator] 모듈이 로드되지 않았습니다.');
        var result = { effects: {}, rawTexts: [], summary: '', totalItems: 0 };
        Object.values(state.equippedRunes).forEach(function(rune) {
            if (rune) {
                result.totalItems++;
                var parsed = parseRuneEffect(rune, state.enhanceLevel);
                if (parsed && parsed.effects) {
                    Object.entries(parsed.effects).forEach(function([name, value]) {
                        if (!result.effects[name]) result.effects[name] = 0;
                        result.effects[name] += value;
                    });
                }
            }
        });
        return result;
    }

    // ============================================
    // 11. 추천 시스템 (Recommendation 모듈 참조)
    // ============================================
    // @updated 2025-12-11 - Recommendation 모듈로 완전 분리
    // @see modules/recommendation.js

    /**
     * 추천 실행 (Recommendation 모듈 참조)
     */
    function runRecommendation() {
        if (window.Recommendation && window.Recommendation.runRecommendation) {
            window.Recommendation.runRecommendation();
            return;
        }
        console.warn('[Recommendation] 모듈이 로드되지 않았습니다.');
        showToast('추천 모듈을 로드하지 못했습니다.', 'error');
    }

    /**
     * 추천 결과 적용 (Recommendation 모듈 참조)
     * @param {Array} recommendations - 추천 목록
     */
    function applyRecommendations(recommendations) {
        if (window.Recommendation && window.Recommendation.applyRecommendations) {
            window.Recommendation.applyRecommendations(recommendations);
            return;
        }
        
        // 폴백: 직접 장착
        if (!recommendations || !Array.isArray(recommendations)) return;
        recommendations.forEach(function(rec) {
            if (rec && rec.rune && rec.slot) {
                equipRune(rec.rune, rec.slot);
            }
        });
        updateEquippedDisplay();
        showToast('추천 룬이 장착되었습니다.', 'success');
    }

    // 12. 즐겨찾기 (Favorites)
    // ============================================

    /**
     * 즐겨찾기 토글
     * @param {number} runeId - 룬 ID
     */
    function toggleFavorite(runeId) {
        const index = state.favorites.indexOf(runeId);

        if (index === -1) {
            state.favorites.push(runeId);
            showToast('즐겨찾기에 추가되었습니다.', 'success');
        } else {
            state.favorites.splice(index, 1);
            showToast('즐겨찾기에서 제거되었습니다.', 'success');
        }

        saveFavorites();
        renderRuneList(); // 목록 업데이트
        renderFavorites(); // 즐겨찾기 탭 업데이트
    }

    /**
     * 즐겨찾기 저장
     */
    function saveFavorites() {
        saveToStorage(STORAGE_KEYS.FAVORITES, state.favorites);
    }

    /**
     * 즐겨찾기 불러오기
     */
    function loadFavorites() {
        state.favorites = loadFromStorage(STORAGE_KEYS.FAVORITES, []);
    }

    /**
     * 즐겨찾기 목록 렌더링
     */
    function renderFavorites() {
        const grid = $('#favorites-grid');
        const emptyEl = $('#favorites-empty');

        if (!grid) return;

        const favoriteRunes = state.allRunes.filter(rune => state.favorites.includes(rune.id));

        if (favoriteRunes.length === 0) {
            if (emptyEl) emptyEl.style.display = 'flex';
            grid.innerHTML = '';
            grid.appendChild(emptyEl);
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';
        grid.innerHTML = favoriteRunes.map(rune => createRuneCard(rune)).join('');
    }

    // ============================================
    // 13. 모달 관리 (Modal)
    // ============================================

    /**
     * 룬 선택 모달 열기
     * @param {string} slotId - 슬롯 ID
     * @updated 2025-12-10 - 새로운 등급 체계 기반 정렬
     */
    function openRuneSelectModal(slotId) {
        const modal = $('#rune-select-modal');
        if (!modal) return;

        state.selectedSlot = slotId;
        const slotConfig = SLOT_CONFIG[slotId];

        // 해당 카테고리의 룬만 필터링
        const categoryRunes = state.allRunes.filter(rune => {
            return rune.category === slotConfig.category;
        }).sort((a, b) => {
            // 등급 우선순위 정렬
            const gradeInfoA = getGradeInfo(a);
            const gradeInfoB = getGradeInfo(b);
            const priorityA = gradeInfoA ? gradeInfoA.priority : 999;
            const priorityB = gradeInfoB ? gradeInfoB.priority : 999;
            return priorityA - priorityB;
        });

        renderModalRuneList(categoryRunes);
        modal.classList.add('modal--open');
    }

    /**
     * 모달 룬 목록 렌더링
     * @param {Array} runes - 룬 목록
     * @updated 2025-12-10 - 새로운 등급 체계 적용
     */
    function renderModalRuneList(runes) {
        const listEl = $('#modal-rune-list');
        if (!listEl) return;

        if (runes.length === 0) {
            listEl.innerHTML = '<p class="effect-empty">해당하는 룬이 없습니다.</p>';
            return;
        }

        listEl.innerHTML = runes.map(rune => {
            const gradeInfo = getGradeInfo(rune) || {
                name: '??',
                color: 'gray'
            };
            return `
                <div class="modal-rune-item" data-rune-id="${rune.id}">
                    <img class="modal-rune-item__image" 
                         src="${rune.image || 'https://via.placeholder.com/40'}" 
                         alt="${escapeHtml(rune.name)}"
                         onerror="this.src='https://via.placeholder.com/40?text=No'">
                    <div class="modal-rune-item__info">
                        <div class="modal-rune-item__name">${escapeHtml(rune.name)}</div>
                        <div class="modal-rune-item__grade">${gradeInfo.name}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 룬 상세 모달 열기
     * @param {number} runeId - 룬 ID
     * @updated 2025-12-10 - 새로운 등급 체계 적용
     */
    function openRuneDetailModal(runeId) {
        const modal = $('#rune-detail-modal');
        const contentEl = $('#rune-detail-content');
        const titleEl = $('#detail-modal-title');

        if (!modal || !contentEl) return;

        const rune = state.allRunes.find(r => r.id === runeId);
        if (!rune) return;

        const gradeInfo = getGradeInfo(rune) || {
            name: '??',
            color: 'gray'
        };
        const categoryName = CATEGORY_MAP[rune.category] || '기타';
        const className = CLASS_MAP[rune.klass] || '전체';
        const effects = parseRuneEffects(rune.description, 15);

        if (titleEl) titleEl.textContent = rune.name;

        contentEl.innerHTML = `
            <img class="rune-detail__image" 
                 src="${rune.image || 'https://via.placeholder.com/80'}" 
                 alt="${escapeHtml(rune.name)}"
                 onerror="this.src='https://via.placeholder.com/80?text=No+Image'">
            <h3 class="rune-detail__name">${escapeHtml(rune.name)}</h3>
            <div class="rune-detail__meta">
                <span class="rune-card__badge rune-card__badge--grade rune-card__badge--${gradeInfo.color}">${gradeInfo.name}</span>
                <span class="rune-card__badge rune-card__badge--category">${categoryName}</span>
                <span class="rune-card__badge">${className}</span>
            </div>
            <div class="rune-detail__description">
                ${rune.description || '설명 없음'}
            </div>
            ${Object.keys(effects).length > 0 ? `
                <div class="rune-detail__effects">
                    <h4 class="rune-detail__effects-title">📊 파싱된 효과 (+15 강화 기준)</h4>
                    ${Object.entries(effects).map(([key, value]) => `
                        <div class="rune-detail__effect-item">
                            <span>${escapeHtml(key)}</span>
                            <span>+${value.toFixed(1)}%</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${rune.drop_location ? `
                <div class="rune-detail__effects" style="margin-top: var(--spacing-md);">
                    <h4 class="rune-detail__effects-title">📍 획득처</h4>
                    <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                        ${escapeHtml(rune.drop_location)}
                    </p>
                </div>
            ` : ''}
        `;

        modal.classList.add('modal--open');
    }

    /**
     * 모달 닫기
     * @param {string} modalId - 모달 ID
     */
    function closeModal(modalId) {
        const modal = $(`#${modalId}`);
        if (modal) {
            modal.classList.remove('modal--open');
        }
        state.selectedSlot = null;
    }

    /**
     * 모달 내 룬 필터링
     * @updated 2025-12-10 - 새로운 등급 체계 기반 필터링 및 정렬
     * @updated 2025-12-10 - 전설(시즌0) 통합 필터 (legendary_s0) 지원
     */
    function filterModalRunes() {
        var modalSearch = $('#modal-search');
        var modalGrade = $('#modal-grade');
        var searchVal = modalSearch ? modalSearch.value : '';
        const searchValue = searchVal ? searchVal.toLowerCase() : '';
        const gradeValue = (modalGrade ? modalGrade.value : null) || 'all';
        const slotConfig = SLOT_CONFIG[state.selectedSlot];

        if (!slotConfig) return;

        const filteredRunes = state.allRunes.filter(rune => {
            // 카테고리 필터
            if (rune.category !== slotConfig.category) return false;

            // 검색어 필터
            if (searchValue && !rune.name.toLowerCase().includes(searchValue)) {
                return false;
            }

            // 등급 필터 (새로운 체계: grade_stars 키 사용)
            if (gradeValue !== 'all') {
                const gradeKey = getGradeKey(rune);
                // 전설(시즌0) 통합 필터 처리
                if (gradeValue === 'legendary_s0') {
                    if (gradeKey !== '07_6' && gradeKey !== '05_6') {
                        return false;
                    }
                } else if (gradeKey !== gradeValue) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            // 등급 우선순위 정렬
            const gradeInfoA = getGradeInfo(a);
            const gradeInfoB = getGradeInfo(b);
            const priorityA = gradeInfoA ? gradeInfoA.priority : 999;
            const priorityB = gradeInfoB ? gradeInfoB.priority : 999;
            return priorityA - priorityB;
        });

        renderModalRuneList(filteredRunes);
    }

    // ============================================
    // 14. 프리셋 관리 (Presets)
    // ============================================

    /**
     * 프리셋 저장 모달 열기
     */
    function openSavePresetModal() {
        const modal = $('#preset-modal');
        const titleEl = $('#preset-modal-title');
        const saveForm = $('#preset-save-form');
        const listEl = $('#preset-list');

        if (!modal) return;

        if (titleEl) titleEl.textContent = '프리셋 저장';
        if (saveForm) saveForm.style.display = 'flex';
        if (listEl) listEl.style.display = 'none';

        modal.classList.add('modal--open');
    }

    /**
     * 프리셋 불러오기 모달 열기
     */
    function openLoadPresetModal() {
        const modal = $('#preset-modal');
        const titleEl = $('#preset-modal-title');
        const saveForm = $('#preset-save-form');
        const listEl = $('#preset-list');

        if (!modal) return;

        if (titleEl) titleEl.textContent = '프리셋 불러오기';
        if (saveForm) saveForm.style.display = 'none';
        if (listEl) listEl.style.display = 'block';

        renderPresetList();
        modal.classList.add('modal--open');
    }

    /**
     * 프리셋 저장
     */
    function savePreset() {
        const nameInput = $('#preset-name-input');
        var nameVal = nameInput ? nameInput.value : '';
        const name = nameVal ? nameVal.trim() : '';

        if (!name) {
            showToast('프리셋 이름을 입력해주세요.', 'error');
            return;
        }

        const preset = {
            id: Date.now(),
            name: name,
            date: new Date().toLocaleDateString('ko-KR'),
            runes: {
                ...state.equippedRunes
            }
        };

        state.presets.push(preset);
        saveToStorage(STORAGE_KEYS.PRESETS, state.presets);

        closeModal('preset-modal');
        if (nameInput) nameInput.value = '';

        showToast(`프리셋 "${name}"이 저장되었습니다.`, 'success');
    }

    /**
     * 프리셋 불러오기
     * @param {number} presetId - 프리셋 ID
     */
    function loadPreset(presetId) {
        const preset = state.presets.find(p => p.id === presetId);
        if (!preset) return;

        state.equippedRunes = {
            ...preset.runes
        };

        Object.keys(SLOT_CONFIG).forEach(slotId => renderSlot(slotId));
        calculateTotalEffects();
        renderEquippedRuneList();
        saveEquippedRunes();

        closeModal('preset-modal');
        showToast(`프리셋 "${preset.name}"을 불러왔습니다.`, 'success');
    }

    /**
     * 프리셋 삭제
     * @param {number} presetId - 프리셋 ID
     */
    function deletePreset(presetId) {
        const index = state.presets.findIndex(p => p.id === presetId);
        if (index === -1) return;

        const preset = state.presets[index];
        state.presets.splice(index, 1);
        saveToStorage(STORAGE_KEYS.PRESETS, state.presets);

        renderPresetList();
        showToast(`프리셋 "${preset.name}"이 삭제되었습니다.`, 'success');
    }

    /**
     * 프리셋 목록 렌더링
     */
    function renderPresetList() {
        const listEl = $('#preset-list');
        if (!listEl) return;

        if (state.presets.length === 0) {
            listEl.innerHTML = '<p class="effect-empty">저장된 프리셋이 없습니다.</p>';
            return;
        }

        listEl.innerHTML = state.presets.map(preset => `
            <div class="preset-item" data-preset-id="${preset.id}">
                <div>
                    <div class="preset-item__name">${escapeHtml(preset.name)}</div>
                    <div class="preset-item__date">${preset.date}</div>
                </div>
                <button class="preset-item__delete" data-action="delete-preset" data-preset-id="${preset.id}">
                    🗑️
                </button>
            </div>
        `).join('');
    }

    /**
     * 프리셋 불러오기
     */
    function loadPresets() {
        state.presets = loadFromStorage(STORAGE_KEYS.PRESETS, []);
    }

    // ============================================
    // 15. 토스트 알림 (Toast)
    // ============================================
    // @updated 2025-12-11 - UIManager 모듈 참조 방식으로 변경

    /**
     * 토스트 알림 표시 (UIManager 모듈 우선 사용)
     * @param {string} message - 메시지
     * @param {string} type - 타입 ('success', 'error', 'warning')
     * @param {number} duration - 표시 시간 (ms)
     */
    function showToast(message, type, duration) {
        type = type || 'success';
        duration = duration || 3000;

        // UIManager 모듈이 있으면 사용
        if (UI.showToast) {
            UI.showToast(message, type, duration);
            return;
        }

        // 폴백: 직접 구현
        const container = $('#toast-container');
        if (!container) return;

        const icons = { success: '✅', error: '❌', warning: '⚠️' };
        const toast = document.createElement('div');
        toast.className = 'toast toast--' + type;
        toast.innerHTML = 
            '<span class="toast__icon">' + (icons[type] || '📢') + '</span>' +
            '<span class="toast__message">' + escapeHtml(message) + '</span>' +
            '<button class="toast__close">×</button>';

        container.appendChild(toast);
        toast.querySelector('.toast__close').addEventListener('click', function() { toast.remove(); });
        setTimeout(function() {
            toast.style.animation = 'fadeOut var(--transition-normal)';
            setTimeout(function() { toast.remove(); }, 250);
        }, duration);
    }

    // ============================================
    // 16. 탭 관리 (Tab Management)
    // ============================================
    // @updated 2025-12-11 - UIManager 모듈 참조 방식으로 변경

    /**
     * 탭 전환 (UIManager 모듈 우선 사용)
     * @param {string} tabId - 탭 ID
     */
    function switchTab(tabId) {
        // UIManager 모듈이 있으면 사용
        if (UI.switchTab) {
            UI.switchTab(tabId, function(tid) {
                if (tid === 'favorites') renderFavorites();
            });
            return;
        }

        // 폴백: 직접 구현
        $$('.tab-nav__btn').forEach(function(btn) {
            btn.classList.toggle('tab-nav__btn--active', btn.dataset.tab === tabId);
        });
        $$('.tab-content').forEach(function(content) {
            content.classList.toggle('tab-content--active', content.id === 'tab-' + tabId);
        });
        if (tabId === 'favorites') renderFavorites();
    }

    // ============================================
    // 17. 이벤트 핸들러 (Event Handlers)
    // ============================================

    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 탭 네비게이션
        $$('.tab-nav__btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // 필터 이벤트
        const searchInput = $('#search-input');
        const categorySelect = $('#filter-category');
        const gradeSelect = $('#filter-grade');
        const classSelect = $('#filter-class');
        const resetBtn = $('#btn-reset-filter');

        if (searchInput) {
            searchInput.addEventListener('input', debounce(e => {
                updateFilter('search', e.target.value);
            }, 300));
        }

        if (categorySelect) {
            categorySelect.addEventListener('change', e => {
                updateFilter('category', e.target.value);
            });
        }

        if (gradeSelect) {
            gradeSelect.addEventListener('change', e => {
                updateFilter('grade', e.target.value);
            });
        }

        if (classSelect) {
            classSelect.addEventListener('change', e => {
                updateFilter('klass', e.target.value);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', resetFilters);
        }

        // 페이지네이션 이벤트 위임
        const pagination = $('#pagination');
        if (pagination) {
            pagination.addEventListener('click', e => {
                const btn = e.target.closest('.pagination__btn');
                if (btn && !btn.disabled) {
                    changePage(btn.dataset.page);
                }
            });
        }

        // 룬 카드 이벤트 위임
        const runeGrid = $('#rune-grid');
        if (runeGrid) {
            runeGrid.addEventListener('click', handleRuneCardClick);
        }

        // 즐겨찾기 그리드 이벤트 위임
        const favGrid = $('#favorites-grid');
        if (favGrid) {
            favGrid.addEventListener('click', handleRuneCardClick);
        }

        // 장착된 룬 목록 클릭 이벤트 위임 (상세정보 모달)
        // @added 2025-12-10
        const equippedList = $('#equipped-runes-list');
        if (equippedList) {
            equippedList.addEventListener('click', function(e) {
                var item = e.target.closest('.equipped-rune-item');
                if (item && item.dataset.runeId) {
                    openRuneDetailModal(parseInt(item.dataset.runeId));
                }
            });
        }

        // 추천 결과 클릭 이벤트 위임 (상세정보 모달)
        // @added 2025-12-10
        const recommendSlots = $('#recommend-slots');
        if (recommendSlots) {
            recommendSlots.addEventListener('click', function(e) {
                var item = e.target.closest('.recommend-rune-item');
                if (item && item.dataset.runeId) {
                    openRuneDetailModal(parseInt(item.dataset.runeId));
                }
            });
        }

        // 슬롯 클릭 이벤트
        $$('.rune-slot').forEach(slot => {
            slot.addEventListener('click', e => {
                // 삭제 버튼 클릭 시
                const removeBtn = e.target.closest('.rune-slot__remove');
                if (removeBtn) {
                    unequipRune(removeBtn.dataset.slot);
                    return;
                }

                // 슬롯 클릭 시 모달 열기
                openRuneSelectModal(slot.dataset.slot);
            });
        });

        // 강화 단계 일괄 적용 @updated 2025-12-10
        $$('input[name="enhance-level"]').forEach(radio => {
            radio.addEventListener('change', e => {
                const enhanceLevel = parseInt(e.target.value);
                applyEnhanceLevelToAll(enhanceLevel);
            });
        });

        // 슬롯 관리 버튼
        const clearBtn = $('#btn-clear-all-slots');
        const savePresetBtn = $('#btn-save-preset');
        const loadPresetBtn = $('#btn-load-preset');

        if (clearBtn) {
            clearBtn.addEventListener('click', clearAllSlots);
        }

        if (savePresetBtn) {
            savePresetBtn.addEventListener('click', openSavePresetModal);
        }

        if (loadPresetBtn) {
            loadPresetBtn.addEventListener('click', openLoadPresetModal);
        }

        // 추천 시스템 버튼
        const recommendBtn = $('#btn-recommend');
        const resetStatsBtn = $('#btn-reset-stats');
        const applyRecommendBtn = $('#btn-apply-recommend');

        if (recommendBtn) {
            recommendBtn.addEventListener('click', runRecommendation);
        }

        if (resetStatsBtn) {
            resetStatsBtn.addEventListener('click', resetStats);
        }

        if (applyRecommendBtn) {
            applyRecommendBtn.addEventListener('click', applyRecommendations);
        }

        // ============================================
        // 캐릭터 스탯 자동 저장 이벤트 리스너 @added 2025-12-11
        // ============================================
        // 디바운스 적용된 스탯 저장 함수 (입력 후 500ms 후 저장)
        const debouncedSaveStats = debounce(saveCharacterStats, 500);

        // 모든 스탯 입력 필드에 input 이벤트 리스너 추가
        CHARACTER_STAT_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element) {
                element.addEventListener('input', debouncedSaveStats);
            }
        });

        // 추천 옵션 필드에 change 이벤트 리스너 추가
        RECOMMEND_OPTION_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element) {
                element.addEventListener('change', saveRecommendOptions);
            }
        });

        // 모달 닫기 버튼
        var modalClose = $('#modal-close');
        var detailModalClose = $('#detail-modal-close');
        var presetModalClose = $('#preset-modal-close');

        if (modalClose) {
            modalClose.addEventListener('click', function() {
                closeModal('rune-select-modal');
            });
        }
        if (detailModalClose) {
            detailModalClose.addEventListener('click', function() {
                closeModal('rune-detail-modal');
            });
        }
        if (presetModalClose) {
            presetModalClose.addEventListener('click', function() {
                closeModal('preset-modal');
            });
        }

        // 모달 오버레이 클릭 시 닫기
        $$('.modal__overlay').forEach(overlay => {
            overlay.addEventListener('click', () => {
                const modal = overlay.closest('.modal');
                if (modal) {
                    modal.classList.remove('modal--open');
                }
            });
        });

        // 모달 내 필터
        const modalSearch = $('#modal-search');
        const modalGrade = $('#modal-grade');

        if (modalSearch) {
            modalSearch.addEventListener('input', debounce(filterModalRunes, 300));
        }

        if (modalGrade) {
            modalGrade.addEventListener('change', filterModalRunes);
        }

        // 모달 내 룬 선택
        const modalRuneList = $('#modal-rune-list');
        if (modalRuneList) {
            modalRuneList.addEventListener('click', e => {
                const runeItem = e.target.closest('.modal-rune-item');
                if (runeItem && state.selectedSlot) {
                    const runeId = parseInt(runeItem.dataset.runeId);
                    const rune = state.allRunes.find(r => r.id === runeId);
                    if (rune) {
                        equipRune(state.selectedSlot, rune);
                        closeModal('rune-select-modal');
                    }
                }
            });
        }

        // 프리셋 저장 확인
        const presetSaveConfirm = $('#btn-preset-save-confirm');
        if (presetSaveConfirm) {
            presetSaveConfirm.addEventListener('click', savePreset);
        }

        // 프리셋 목록 클릭 이벤트 위임
        const presetList = $('#preset-list');
        if (presetList) {
            presetList.addEventListener('click', e => {
                const deleteBtn = e.target.closest('[data-action="delete-preset"]');
                if (deleteBtn) {
                    e.stopPropagation();
                    deletePreset(parseInt(deleteBtn.dataset.presetId));
                    return;
                }

                const presetItem = e.target.closest('.preset-item');
                if (presetItem) {
                    loadPreset(parseInt(presetItem.dataset.presetId));
                }
            });
        }
    }

    /**
     * 룬 카드 클릭 핸들러
     * @param {Event} e - 클릭 이벤트
     */
    function handleRuneCardClick(e) {
        const favoriteBtn = e.target.closest('[data-action="favorite"]');
        if (favoriteBtn) {
            const runeId = parseInt(favoriteBtn.dataset.runeId);
            toggleFavorite(runeId);
            return;
        }

        const detailBtn = e.target.closest('[data-action="detail"]');
        if (detailBtn) {
            const runeId = parseInt(detailBtn.dataset.runeId);
            openRuneDetailModal(runeId);
            return;
        }

        // 카드 자체 클릭 시 상세 모달
        const card = e.target.closest('.rune-card');
        if (card && !e.target.closest('.rune-card__actions')) {
            const runeId = parseInt(card.dataset.runeId);
            openRuneDetailModal(runeId);
        }
    }

    // ============================================
    // 18. 초기화 (Initialization)
    // ============================================

    /**
     * 애플리케이션 초기화
     */
    /**
     * 애플리케이션 초기화
     * @async
     * @updated 2025-12-11 - 캐릭터 스탯 및 추천 옵션 불러오기 추가
     * @updated 2025-12-11 - CharacterManager 모듈 초기화 추가
     */
    async function init() {
        console.log('🚀 마비노기 모바일 룬 효율 계산기 초기화 시작...');

        // 저장된 데이터 불러오기
        loadFavorites();
        loadPresets();

        // 이벤트 리스너 설정
        setupEventListeners();

        // 룬 데이터 로드
        await loadRuneData();

        // 장착된 룬 불러오기
        loadEquippedRunes();

        // 저장된 캐릭터 스탯 불러오기 @added 2025-12-11
        loadCharacterStats();

        // 저장된 추천 옵션 불러오기 @added 2025-12-11
        loadRecommendOptions();

        // 페이지네이션 렌더링
        renderPagination();

        // CharacterManager 모듈 초기화 @added 2025-12-11
        // (모듈 로드 후 자동 실행되므로 여기서 확인만)
        if (window.CharacterManager) {
            console.log('📋 CharacterManager 모듈 연동 완료');
        }

        console.log('✅ 초기화 완료!');
    }

    // ============================================
    // 19. 전역 인터페이스 (Global Interface)
    // ============================================
    // @added 2025-12-11 - 외부 모듈과의 연동을 위한 인터페이스

    /**
     * 현재 상태 반환 (CharacterManager 연동용)
     * @returns {Object} 현재 앱 상태
     */
    function getState() {
        return {
            equippedRunes: state.equippedRunes,
            enhanceLevels: state.enhanceLevels,
            favorites: state.favorites,
            presets: state.presets
        };
    }

    /**
     * 프로필 데이터 로드 (CharacterManager 연동용)
     * @param {Object} data - 프로필 데이터 { equippedRunes, enhanceLevels }
     */
    function loadProfileData(data) {
        if (!data) return;

        // 장착된 룬 적용
        if (data.equippedRunes) {
            state.equippedRunes = data.equippedRunes;
        }

        // 강화 수치 적용
        if (data.enhanceLevels) {
            state.enhanceLevels = data.enhanceLevels;
        }

        // UI 업데이트
        Object.keys(SLOT_CONFIG).forEach(slotId => renderSlot(slotId));
        calculateTotalEffects();
        renderEquippedRuneList();

        // 저장
        saveEquippedRunes();
        saveEnhanceLevels();
    }

    /**
     * 전역 인터페이스 등록
     * @global
     */
    window.RuneCalculator = {
        // 상태 조회
        getState: getState,
        
        // 프로필 데이터 로드
        loadProfileData: loadProfileData,
        
        // 토스트 알림
        showToast: showToast
    };

    // DOMContentLoaded 시 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();