/**
 * ============================================
 * 마비노기 모바일 룬 효율 계산기 - JavaScript
 * ============================================
 * @file        rune-calculator.js
 * @description 룬 데이터 로딩, 필터링, 시뮬레이션, 추천 기능 구현
 * @author      Dalkong Project
 * @created     2025-12-10
 * @modified    2025-12-10
 * @version     1.0.0
 * 
 * @architecture
 * - 모듈 패턴 사용 (IIFE)
 * - 이벤트 위임 패턴 활용
 * - LocalStorage를 통한 데이터 영속화
 * 
 * @structure
 * 1. 상수 정의 (Constants)
 * 2. 전역 상태 (State)
 * 3. 유틸리티 함수 (Utilities)
 * 4. 데이터 로딩 (Data Loading)
 * 5. 필터링/검색 (Filtering)
 * 6. 룬 카드 렌더링 (Rendering)
 * 7. 페이지네이션 (Pagination)
 * 8. 슬롯 관리 (Slot Management)
 * 9. 효과 파싱 엔진 (Effect Parser)
 * 10. 효과 합산 (Effect Calculator)
 * 11. 추천 시스템 (Recommendation)
 * 12. 즐겨찾기 (Favorites)
 * 13. 모달 관리 (Modal)
 * 14. 토스트 알림 (Toast)
 * 15. 이벤트 핸들러 (Event Handlers)
 * 16. 초기화 (Initialization)
 */

// ============================================
// 전역 상수 및 유틸리티 (IIFE 외부)
// ============================================

/**
 * 기본 이미지 (SVG 데이터 URI)
 * @constant {string}
 * @global
 * @added 2025-12-11 - 외부 placeholder 서비스 대체
 * @description 룬 이미지가 없거나 로드 실패 시 표시되는 기본 이미지
 */
var RUNE_DEFAULT_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIGZpbGw9IiMyMzI3MkUiLz48cGF0aCBkPSJNMjQgMTJMMzIgMjBMMjQgMzZMMTYgMjBMMjQgMTJaIiBzdHJva2U9IiM4QjVDRjYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjIiIHI9IjQiIGZpbGw9IiM4QjVDRjYiLz48L3N2Zz4=';

/**
 * 이미지 로드 실패 시 기본 이미지로 대체
 * @param {HTMLImageElement} img - 이미지 요소
 * @global
 * @added 2025-12-11
 */
function handleRuneImageError(img) {
    img.onerror = null; // 무한 루프 방지
    img.src = RUNE_DEFAULT_IMAGE;
}

(function() {
    'use strict';

    // ============================================
    // 1. 상수 정의 (Constants)
    // ============================================

    /**
     * 기본 이미지 참조 (전역 상수 사용)
     * @constant {string}
     */
    const DEFAULT_RUNE_IMAGE = RUNE_DEFAULT_IMAGE;

    /**
     * 카테고리 코드 매핑
     * @constant {Object}
     * @updated 2025-12-10 - 카테고리 매핑 수정 (02: 방어구, 04: 엠블럼)
     */
    const CATEGORY_MAP = {
        '01': '무기',
        '02': '방어구',
        '03': '장신구',
        '04': '엠블럼'
    };

    /**
     * 등급 코드 매핑 (grade + stars 조합)
     * @constant {Object}
     * @updated 2025-12-10 - 신화/전설/유니크 등급 체계로 변경
     * @updated 2025-12-10 - 전설(시즌0) 7등급/5등급 통합
     * 
     * 유효한 등급 조합:
     * - grade 08 + stars 8 → 신화
     * - grade 05 + stars 8 → 전설(시즌1)
     * - grade 07 + stars 6 → 전설(시즌0)
     * - grade 05 + stars 6 → 전설(시즌0)
     * - grade 06 + stars 5 → 유니크(시즌0)
     */
    /**
     * 등급 매핑 @updated 2025-12-11 - 시즌1 전설 + 신화만 포함
     */
    const GRADE_MAP = {
        '신화': {
            name: '신화',
            color: '#FFD700',
            priority: 1
        },
        '전설(시즌1)': {
            name: '전설(시즌1)',
            color: '#FF8C00',
            priority: 2
        },
        // @added 2025-12-11 - 필터링용 추가 등급
        '전설(시즌0)': {
            name: '전설(시즌0)',
            color: '#FF6600',
            priority: 4
        },
        '유니크(시즌0)': {
            name: '유니크(시즌0)',
            color: '#9932CC',
            priority: 5
        }
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
     * 룬의 등급 코드 반환 (필터링용)
     * @param {Object} rune - 룬 데이터
     * @returns {string} 등급 코드
     * @added 2025-12-11
     */
    function getGradeCode(rune) {
        const gradeName = rune.gradeName || '';
        if (gradeName === '신화') return '08_8';
        if (gradeName === '전설(시즌1)') return '05_8';
        if (gradeName.includes('전설')) return 'legendary_s0';
        if (gradeName.includes('유니크')) return '06_5';
        return 'other';
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
     * @updated 2025-12-11 - gradeName 기반 조회, 유사 등급 매칭 추가
     */
    function getGradeInfo(rune) {
        const gradeName = getGradeName(rune);
        
        // 정확히 일치하는 경우
        if (GRADE_MAP[gradeName]) {
            return GRADE_MAP[gradeName];
        }
        
        // 유사 등급 매칭 (시즌 표시 없이 "전설", "유니크" 등)
        // @updated 2025-12-11 - 모든 전설/유니크 등급 포함
        if (gradeName.indexOf('신화') !== -1) {
            return { name: gradeName, color: '#FFD700', priority: 1 };
        }
        if (gradeName.indexOf('전설') !== -1) {
            // 시즌1이 포함되면 priority 2, 아니면 3
            if (gradeName.indexOf('시즌1') !== -1) {
                return { name: gradeName, color: '#FF8C00', priority: 2 };
            }
            return { name: gradeName, color: '#FF6600', priority: 3 };
        }
        if (gradeName.indexOf('유니크') !== -1 || gradeName.indexOf('영웅') !== -1) {
            return { name: gradeName, color: '#A855F7', priority: 4 };
        }
        if (gradeName.indexOf('레어') !== -1 || gradeName.indexOf('희귀') !== -1) {
            return { name: gradeName, color: '#3B82F6', priority: 5 };
        }
        
        // 기본값 - priority 3으로 설정하여 필터링되지 않도록
        return {
            name: gradeName,
            color: rune.gradeColor || '#888',
            priority: 3
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
        /** 게임 상수 (등급, 역할, 각성 등) */
        GameConstants: window.GameConstants || null,
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
    /**
     * 룬 효율 점수 계산 (새 모듈 사용) - 간소화된 버전
     * @deprecated 전체 버전은 아래 calculateRuneEfficiencyScore 함수 사용
     * @param {Object} rune - 룬 데이터
     * @param {number} [enhanceLevel=0] - 강화 단계
     * @returns {Object} 효율 점수 결과
     */
    function calculateRuneEfficiencyScoreSimple(rune, enhanceLevel) {
        enhanceLevel = enhanceLevel || 0;

        if (!Modules.EfficiencyCalculator || !currentCharacterStats) {
            return {
                score: 0,
                breakdown: null,
                dotTypes: [],
                effectiveSummary: {}
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
     * 클래스 코드로 클래스명 조회
     * @param {string} code - 클래스 코드
     * @returns {string} 클래스명
     * @added 2025-12-11
     */
    function getClassNameByCode(code) {
        return CLASS_MAP[code] || '전체';
    }

    /**
     * 클래스별 Sub 스텟 매핑
     * @constant {Object}
     * @description 각 클래스의 Sub 스텟에 따른 우선 효과
     * @added 2025-12-11
     */
    const CLASS_SUB_STATS = {
        // 행운 Sub - 치명타, 추가타 우선
        LUCK: ['02', '05', '08', '14', '17', '18', '19', '20'], // 검술사, 석궁사수, 화염술사, 댄서, 격투가, 듀얼블레이드, 암흑술사, 전격술사
        // 의지 Sub - 강타, 궁극기, 회복력 우선
        WILL: ['03', '06', '09', '11', '12', '15'] // 대검전사, 장궁병, 빙결술사, 사제, 수도사, 악사
    };

    /**
     * Sub 스텟별 우선 효과
     * @constant {Object}
     * @added 2025-12-11
     */
    const SUB_STAT_PRIORITY_EFFECTS = {
        LUCK: ['치명타 확률', '치명타 피해', '추가타 확률', '추가타'],
        WILL: ['강타 피해', '궁극기', '회복력']
    };

    /**
     * 클래스 코드로 Sub 스텟 타입 조회
     * @param {string} classCode - 클래스 코드
     * @returns {string|null} Sub 스텟 타입 (LUCK/WILL/null)
     * @added 2025-12-11
     */
    function getClassSubStatType(classCode) {
        if (CLASS_SUB_STATS.LUCK.includes(classCode)) return 'LUCK';
        if (CLASS_SUB_STATS.WILL.includes(classCode)) return 'WILL';
        return null;
    }

    /**
     * 클래스별 우선 효과 목록 조회
     * @param {string} classCode - 클래스 코드
     * @returns {Array<string>} 우선 효과 목록
     * @added 2025-12-11
     */
    function getClassPriorityEffects(classCode) {
        var subStatType = getClassSubStatType(classCode);
        if (subStatType && SUB_STAT_PRIORITY_EFFECTS[subStatType]) {
            return SUB_STAT_PRIORITY_EFFECTS[subStatType];
        }
        return [];
    }

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
     * @updated 2025-12-11 - 캐릭터 프로필 키 추가
     */
    const STORAGE_KEYS = {
        FAVORITES: 'mabinogi_rune_favorites',
        PRESETS: 'mabinogi_rune_presets',
        EQUIPPED_RUNES: 'mabinogi_rune_equipped',
        CHARACTER_PROFILES: 'mabinogi_character_profiles',
        CHARACTER_EQUIPMENTS: 'mabinogi_character_equipments', // @added 2025-12-11
        CHARACTER_OWNED_RUNES: 'mabinogi_character_owned_runes' // @added 2025-12-11 보유 룬
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
        /** @type {Object} 현재 필터 조건 @updated 2025-12-11 - 등급 배열 */
        filters: {
            search: '',
            category: 'all',
            grade: ['08_8', '05_8'],  // 기본: 신화, 전설(S1)
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
        enhanceLevels: {},
        /** @type {Array} 캐릭터 프로필 목록 @added 2025-12-11 */
        characterProfiles: [],
        /** @type {string|null} 전역 선택된 캐릭터 ID (모든 탭 공통) @updated 2025-12-11 */
        selectedCharacterId: null,
        /** @type {Object} 캐릭터별 장착 룬 @added 2025-12-11 */
        characterEquipments: {},
        /** @type {boolean} 장착 탭에서 모달을 열었는지 플래그 @added 2025-12-11 */
        isEquipmentSlot: false,
        /** @type {Object} 캐릭터별 보유 룬 ID 목록 @added 2025-12-11 */
        characterOwnedRunes: {}
    };

    // ============================================
    // 3. 유틸리티 함수 (Utilities)
    // ============================================

    /**
     * DOM 요소 선택 헬퍼
     * @param {string} selector - CSS 선택자
     * @returns {Element|null} DOM 요소
     */
    function $(selector) {
        return document.querySelector(selector);
    }

    /**
     * 다중 DOM 요소 선택 헬퍼
     * @param {string} selector - CSS 선택자
     * @returns {NodeList} DOM 요소 목록
     */
    function $$(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * HTML 특수문자 이스케이프
     * @param {string} text - 원본 텍스트
     * @returns {string} 이스케이프된 텍스트
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * HTML 태그 제거
     * @param {string} html - HTML 문자열
     * @returns {string} 태그가 제거된 텍스트
     */
    function stripHtml(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    /**
     * 디바운스 함수
     * @param {Function} func - 실행할 함수
     * @param {number} wait - 대기 시간 (ms)
     * @returns {Function} 디바운스된 함수
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * LocalStorage에서 데이터 로드
     * @param {string} key - 저장소 키
     * @param {*} defaultValue - 기본값
     * @returns {*} 저장된 데이터 또는 기본값
     */
    function loadFromStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('LocalStorage 로드 오류:', e);
            return defaultValue;
        }
    }

    /**
     * LocalStorage에 데이터 저장
     * @param {string} key - 저장소 키
     * @param {*} value - 저장할 데이터
     */
    function saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('LocalStorage 저장 오류:', e);
        }
    }

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
            // 4개의 분리된 JSON 파일 + 원본 JSON(이미지 정보용) 병렬 로드
            // @updated 2025-12-11 - 원본 runes.json에서 이미지 경로 매핑
            const [weaponRes, armorRes, accessoryRes, emblemRes, originalRes] = await Promise.all([
                fetch('runes-weapon.json'),
                fetch('runes-armor.json'),
                fetch('runes-accessory.json'),
                fetch('runes-emblem.json'),
                fetch('runes.json')
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

            // 원본 JSON에서 이미지 매핑 생성 (룬 이름 → 이미지 경로)
            // @added 2025-12-11 - 수동 파싱 데이터에 이미지 정보 병합용
            const imageMap = {};
            if (originalRes.ok) {
                const originalRunes = await originalRes.json();
                originalRunes.forEach(rune => {
                    if (rune.name && rune.image) {
                        imageMap[rune.name] = rune.image;
                    }
                });
                console.log(`📷 이미지 매핑 생성: ${Object.keys(imageMap).length}개`);
            }

            // 무기 룬은 { runes: [...] } 형태, 나머지는 배열
            const weaponRunes = weaponData.runes || weaponData;
            const armorRunes = armorData;
            const accessoryRunes = accessoryData;
            const emblemRunes = emblemData;

            // 전체 룬 병합
            let allRunes = [
                ...weaponRunes,
                ...armorRunes,
                ...accessoryRunes,
                ...emblemRunes
            ];

            // 이미지 정보 병합 (수동 파싱 데이터에 이미지 추가)
            // @added 2025-12-11 - 원본 JSON의 이미지 경로를 수동 파싱 데이터에 적용
            allRunes = allRunes.map(rune => {
                if (!rune.image && imageMap[rune.name]) {
                    return { ...rune, image: imageMap[rune.name] };
                }
                return rune;
            });

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

            // 등급 필터 (체크박스 배열) @updated 2025-12-11
            if (Array.isArray(grade) && !grade.includes('all')) {
                const runeGradeCode = getGradeCode(rune);
                if (!grade.includes(runeGradeCode)) {
                    return false;
                }
            } else if (grade !== 'all' && !Array.isArray(grade)) {
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
     * @updated 2025-12-11 - 버튼/체크박스 방식 대응
     */
    function resetFilters() {
        state.filters = {
            search: '',
            category: 'all',
            grade: ['08_8', '05_8'],  // 기본: 신화, 전설(S1) 체크
            klass: 'all'
        };

        // 검색 입력 초기화
        const searchInput = $('#search-input');
        if (searchInput) searchInput.value = '';

        // 카테고리 버튼 초기화
        const categoryBtnGroup = $('#filter-category');
        if (categoryBtnGroup) {
            categoryBtnGroup.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === 'all');
            });
        }

        // 등급 체크박스 초기화
        const gradeCheckGroup = $('#filter-grade');
        if (gradeCheckGroup) {
            gradeCheckGroup.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = cb.value === '08_8' || cb.value === '05_8';
            });
        }

        // 클래스 버튼 초기화
        const classBtnGroup = $('#filter-class');
        if (classBtnGroup) {
            classBtnGroup.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === 'all');
            });
        }

        filterRunes();
        showToast('필터가 초기화되었습니다.', 'success');
    }

    // ============================================
    // 6. 룬 카드 렌더링 (Rendering)
    // ============================================

    /**
     * 룬 목록 렌더링
     * @description 그룹별로 전체 룬 목록 표시 (페이징 제거)
     * @updated 2025-12-11 - 그룹별 전체 표시, 순서: 무기-엠블럼-방어구-장신구
     */
    function renderRuneList() {
        const grid = $('#rune-grid');
        if (!grid) return;

        if (state.filteredRunes.length === 0) {
            grid.innerHTML = `
                <div class="loading-indicator">
                    <p>검색 결과가 없습니다.</p>
                </div>
            `;
            return;
        }

        // 카테고리별 그룹화 (순서: 무기-엠블럼-방어구-장신구)
        const categoryOrder = ['01', '04', '02', '03'];
        const categoryNames = {
            '01': '⚔️ 무기 룬',
            '04': '🔥 엠블럼 룬',
            '02': '🛡️ 방어구 룬',
            '03': '💍 장신구 룬'
        };

        // 카테고리별 룬 분류
        const runesByCategory = {};
        categoryOrder.forEach(cat => { runesByCategory[cat] = []; });
        
        state.filteredRunes.forEach(rune => {
            if (runesByCategory[rune.category]) {
                runesByCategory[rune.category].push(rune);
            }
        });

        // 그룹별 HTML 생성
        let html = '';
        categoryOrder.forEach(category => {
            const runes = runesByCategory[category];
            if (runes.length === 0) return;

            html += `
                <div class="rune-group" data-category="${category}">
                    <h3 class="rune-group__title">${categoryNames[category]} (${runes.length}개)</h3>
                    <div class="rune-group__grid">
                        ${runes.map(rune => createRuneCard(rune)).join('')}
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
        
        // 페이지네이션 숨김
        const pagination = $('#pagination');
        if (pagination) pagination.style.display = 'none';

        // 보유 룬 힌트 표시 (캐릭터 선택 시) @added 2025-12-11
        const hintEl = $('#owned-rune-hint');
        if (hintEl) {
            if (state.selectedCharacterId) {
                const profile = state.characterProfiles.find(p => p.id === state.selectedCharacterId);
                const charName = profile ? profile.name : '캐릭터';
                const ownedCount = (state.characterOwnedRunes[state.selectedCharacterId] || []).length;
                hintEl.style.display = 'flex';
                hintEl.innerHTML = `
                    <span class="owned-rune-hint__text">
                        📦 버튼을 눌러 <strong>${escapeHtml(charName)}</strong>의 보유 룬에 추가하세요
                        (현재 ${ownedCount}개 보유)
                    </span>
                `;
            } else {
                hintEl.style.display = 'none';
            }
        }
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
        
        // 보유 룬 상태 확인 (전역 캐릭터 선택 시) @updated 2025-12-11
        const charId = state.selectedCharacterId;
        const isOwned = charId ? isRuneOwned(charId, rune.id) : false;
        const isFavorite = state.favorites.includes(rune.id);
        const isActive = charId ? isOwned : isFavorite;

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

        // 버튼 라벨 및 스타일 @updated 2025-12-11 - 아이콘 동일, 배경색으로 구분
        const btnIcon = '📦';
        const btnTitle = charId ? (isOwned ? '보유 룬에서 제거' : '보유 룬에 추가') : '보유 룬 추가';
        const btnActiveClass = isActive ? 'active' : '';
        const btnClass = charId ? 'rune-card__btn--owned' : 'rune-card__btn--favorite';

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
                    <button class="rune-card__btn ${btnClass} ${isActive ? 'active' : ''}" 
                            data-action="favorite" 
                            data-rune-id="${rune.id}"
                            title="${btnTitle}">
                        ${btnIcon}
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
                         src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                         alt="${escapeHtml(rune.name)}"
                         onerror="handleRuneImageError(this)">
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
                         src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                         alt="${escapeHtml(rune.name)}"
                         onerror="handleRuneImageError(this)">
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
     */
    function saveEnhanceLevels() {
        saveToStorage('rune_enhance_levels', state.enhanceLevels);
    }

    /**
     * 강화 수치 불러오기
     * @added 2025-12-10
     */
    function loadEnhanceLevels() {
        state.enhanceLevels = loadFromStorage('rune_enhance_levels', {});
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

        // @updated 2025-12-11 - rawDescription 지원 추가
        var description = rune.description || rune.rawDescription;
        if (!rune || !description) {
            // @updated 2025-12-11 - dotTypes 추가
            return {
                effects: [],
                totalScore: 0,
                summary: {},
                dotTypes: []
            };
        }

        var text = stripHtml(description);

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
    // 10. 효과 합산 (Effect Calculator)
    // ============================================

    /**
     * 장착된 모든 룬의 효과 합산
     * @updated 2025-12-10 - 고급 효과 파싱 엔진 사용
     * @updated 2025-12-10 - DPS 핵심 효과 구분 표시
     * @updated 2025-12-10 - 한계효용 감소, 시너지 룬, DPS 분석 추가
     */
    function calculateTotalEffects() {
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
    // 11. 추천 시스템 (Recommendation)
    // ============================================

    /**
     * 룬 효율 점수 계산 (수동 파싱된 effects 배열 사용 + 스텟 연계)
     * @param {Object} rune - 룬 데이터 (수동 파싱된 JSON)
     * @param {Object} stats - 캐릭터 스텟 (입력값)
     * @param {string} role - 역할군 (dealer/tank/healer/balanced)
     * @param {number} awakeningCooldownReduction - 각성 쿨타임 감소량 (엠블럼 시너지용)
     * @returns {number} 효율 점수
     * @updated 2025-12-11 - 수동 파싱된 effects 배열 직접 사용
     * @updated 2025-12-11 - stat-formulas.js 모듈 연동 (한계효용, 밸런스 보정)
     */
    function calculateRuneScore(rune, stats, role, awakeningCooldownReduction) {
        awakeningCooldownReduction = awakeningCooldownReduction || 0;
        stats = stats || {};

        // ========================================
        // 헬퍼 함수: 효과 가중치 조회 (부분 문자열 매칭)
        // @added 2025-12-11
        // ========================================
        function getEffectWeightWithFallback(effectName) {
            if (!Modules.EffectWeights) return 1.0;
            
            // 정확한 매칭 먼저 시도
            var weight = Modules.EffectWeights.getEffectWeight(effectName);
            if (weight !== 0) return weight;
            
            // 부분 문자열 매칭
            var nameMap = Modules.EffectWeights.EFFECT_NAME_MAP;
            var weights = Modules.EffectWeights.EFFECT_WEIGHTS;
            
            if (nameMap && weights) {
                var matchedKey = Object.keys(nameMap).find(function(key) {
                    return effectName.indexOf(key) !== -1;
                });
                
                if (matchedKey) {
                    var weightKey = nameMap[matchedKey];
                    return weights[weightKey] || 1.0;
                }
            }
            
            return 1.0; // 기본값
        }

        // ========================================
        // 0. 스텟 기반 동적 보정 계수 계산 (StatFormulas 모듈 사용)
        // ========================================
        var statAdjustments = {
            critMarginalUtility: 1.0,       // 치명타 한계효용
            attackBalanceMultiplier: 1.0,   // 공격력 밸런스 보정
            damageBalanceMultiplier: 1.0,   // 피해량 밸런스 보정
            classPriorityEffects: []        // 클래스별 우선 효과 목록
        };

        // 클래스별 우선 효과 조회
        // @updated 2025-12-11 - 클래스 코드 직접 사용 (역조회 제거)
        if (stats && stats.classCode && stats.classCode !== '00') {
            statAdjustments.classPriorityEffects = getClassPriorityEffects(stats.classCode);
            statAdjustments.classSubStatType = getClassSubStatType(stats.classCode);
        }
        
        // 디버그: 첫 번째 룬에만 상세 로그 출력
        var isFirstRune = !window._runeScoreDebugLogged;
        if (isFirstRune) {
            window._runeScoreDebugLogged = true;
            console.log('🔍 calculateRuneScore 디버그:', {
                룬이름: rune.name,
                stats객체: stats ? '있음' : '없음',
                classCode: stats ? stats.classCode : 'N/A',
                classPriorityEffects: statAdjustments.classPriorityEffects,
                role: role
            });
        }

        if (Modules.StatFormulas) {
            // 치명타 한계효용 계산
            // 현재 치명타 확률이 캡(50%)에 가까우면 추가 치명타 효과의 가치 감소
            if (stats.critical && stats.critical > 1) {
                var currentCritRate = Modules.StatFormulas.calculateCritRate(
                    stats.critical,
                    stats.critRateBonus || 0
                );
                statAdjustments.critMarginalUtility = Modules.StatFormulas.calculateCritMarginalUtility(currentCritRate);
            }

            // 공격력/피해량 밸런스 보정
            // 곱연산 특성상 둘의 비율이 비슷할수록 효율적
            if ((stats.attackBonus && stats.attackBonus > 0) || (stats.damageBonus && stats.damageBonus > 0)) {
                var balance = Modules.StatFormulas.calculateBonusBalance(
                    stats.attackBonus || 0,
                    stats.damageBonus || 0
                );
                statAdjustments.attackBalanceMultiplier = balance.attackMultiplier;
                statAdjustments.damageBalanceMultiplier = balance.damageMultiplier;
            }
        }

        // 역할별 효과 가중치 (GameConstants 모듈 사용)
        // @updated 2025-12-11 - 매직넘버를 상수로 대체
        var roleMultipliers = (Modules.GameConstants && Modules.GameConstants.ROLE_MULTIPLIERS) 
            ? Modules.GameConstants.ROLE_MULTIPLIERS 
            : {
                dealer: { '공격력 증가': 1.5, '피해량 증가': 1.5 },
                tank: { '받는 피해 감소': 2.0 },
                healer: { '회복력 증가': 2.0 },
                balanced: { '공격력 증가': 1.0, '피해량 증가': 1.0 }
            };

        var defaultRoleWeight = (Modules.GameConstants && Modules.GameConstants.DEFAULT_ROLE_WEIGHT) 
            ? Modules.GameConstants.DEFAULT_ROLE_WEIGHT 
            : 1.0;

        const multipliers = roleMultipliers[role] || roleMultipliers.balanced;

        // ========================================
        // 1. 기본 효과 점수 계산 (수동 파싱된 effects 배열 사용)
        // ========================================
        let score = 0;
        let effectSummary = {};

        if (rune.effects && Array.isArray(rune.effects)) {
            rune.effects.forEach(function(effect) {
                // DPS 관련 효과만 계산
                if (effect.dpsRelevant === false) {
                    return; // 스킵
                }

                var effectName = effect.name || '';
                var value = effect.value || 0;
                var effectType = effect.type || 'PERMANENT';

                // 유형별 가중치 (GameConstants 모듈 사용)
                // @updated 2025-12-11 - 매직넘버를 상수로 대체
                var typeWeights = (Modules.GameConstants && Modules.GameConstants.EFFECT_TYPE_WEIGHTS)
                    ? Modules.GameConstants.EFFECT_TYPE_WEIGHTS
                    : { PERMANENT: 1.0, STACKING: 0.95, TRIGGER: 0.8, STATE: 0.7, DURATION: 0.5, DECAY: 0.3, DEFAULT: 0.7 };

                var typeWeight = typeWeights.PERMANENT;
                switch (effectType) {
                    case 'PERMANENT': typeWeight = typeWeights.PERMANENT; break;
                    case 'STACKING':
                        typeWeight = typeWeights.STACKING;
                        // 중첩 효과는 최대값 계산
                        if (effect.maxStacks && effect.stackValue) {
                            value = effect.stackValue * effect.maxStacks;
                        }
                        break;
                    case 'TRIGGER': typeWeight = typeWeights.TRIGGER; break;
                    case 'DURATION':
                        // 업타임 계산 (StatFormulas 모듈 사용)
                        if (effect.duration && effect.cooldown) {
                            if (Modules.StatFormulas && Modules.StatFormulas.calculateUptime) {
                                typeWeight = Modules.StatFormulas.calculateUptime(effect.duration, effect.cooldown);
                            } else {
                                typeWeight = effect.duration / (effect.duration + effect.cooldown);
                            }
                        } else {
                            typeWeight = typeWeights.DURATION;
                        }
                        break;
                    case 'DECAY':
                        // 시간 감소 효과 평균값 계산 (StatFormulas 모듈 사용)
                        if (Modules.StatFormulas && Modules.StatFormulas.calculateDecayAverage &&
                            effect.initialValue && effect.decayRate && effect.decayInterval) {
                            var avgValue = Modules.StatFormulas.calculateDecayAverage(
                                effect.initialValue,
                                effect.decayRate,
                                effect.decayInterval
                            );
                            typeWeight = avgValue / effect.initialValue;
                        } else {
                            typeWeight = typeWeights.DECAY;
                        }
                        break;
                    case 'STATE': typeWeight = typeWeights.STATE; break; // HP/자원 조건
                    default: typeWeight = typeWeights.DEFAULT;
                }

                // 효과 가중치 (헬퍼 함수 사용)
                // @updated 2025-12-11 - 부분 문자열 매칭으로 가중치 조회
                var effectWeight = getEffectWeightWithFallback(effectName);

                // 역할별 가중치
                var roleWeight = multipliers[effectName] || defaultRoleWeight;

                // ========================================
                // 스텟 기반 동적 보정 적용
                // ========================================
                var statMultiplier = 1.0;

                // 치명타 확률: 한계효용 적용
                if (effectName.indexOf('치명타 확률') !== -1 || effectName === '치명타') {
                    statMultiplier *= statAdjustments.critMarginalUtility;
                }

                // 공격력: 밸런스 보정 적용
                if (effectName.indexOf('공격력') !== -1) {
                    statMultiplier *= statAdjustments.attackBalanceMultiplier;
                }

                // 피해량: 밸런스 보정 적용
                if (effectName.indexOf('피해량') !== -1 || effectName.indexOf('피해') !== -1) {
                    statMultiplier *= statAdjustments.damageBalanceMultiplier;
                }

                // ========================================
                // 클래스별 우선 효과 보너스 적용
                // @updated 2025-12-11 - Sub 스텟 관련 효과에 +25% 보너스
                // ========================================
                var classBonus = 1.0;
                var CLASS_PRIORITY_BONUS = (Modules.GameConstants && Modules.GameConstants.CLASS_PRIORITY_BONUS)
                    ? Modules.GameConstants.CLASS_PRIORITY_BONUS
                    : 0.25; // Sub 스텟 보너스 25%

                if (statAdjustments.classPriorityEffects && statAdjustments.classPriorityEffects.length > 0) {
                    var isPriorityEffect = statAdjustments.classPriorityEffects.some(function(priority) {
                        return effectName.indexOf(priority) !== -1;
                    });
                    if (isPriorityEffect) {
                        classBonus = 1.0 + CLASS_PRIORITY_BONUS;
                        // 디버그: 클래스 보너스 적용 확인
                        if (!rune._classBonusLogged) {
                            console.log('✅ 클래스 보너스 적용:', rune.name, effectName, '+' + (CLASS_PRIORITY_BONUS * 100) + '%');
                        }
                    }
                }

                // 최종 효과 점수
                var effectScore = value * effectWeight * typeWeight * roleWeight * statMultiplier * classBonus;
                score += effectScore;

                // 효과 요약 저장
                if (!effectSummary[effectName]) {
                    effectSummary[effectName] = { total: 0, count: 0 };
                }
                effectSummary[effectName].total += value;
                effectSummary[effectName].count++;
            });
        }

        // ========================================
        // 2. 결함 점수 차감
        // ========================================
        if (rune.demerits && Array.isArray(rune.demerits)) {
            rune.demerits.forEach(function(demerit) {
                var demeritName = demerit.name || '';
                var demeritValue = demerit.value || 0;

                // 결함 가중치
                var demeritWeight = 1.0;
                if (Modules.EffectWeights && Modules.EffectWeights.getDemeritWeight) {
                    demeritWeight = Modules.EffectWeights.getDemeritWeight(demeritName);
                    if (demeritWeight === 0) demeritWeight = 0.7;
                }

                score -= demeritValue * demeritWeight;
            });
        }

        // ========================================
        // 3. 강화 효과 점수 (+15 기준)
        // ========================================
        if (rune.enhanceEffects) {
            ['10', '15'].forEach(function(level) {
                var enhanceList = rune.enhanceEffects[level];
                if (enhanceList && Array.isArray(enhanceList)) {
                    enhanceList.forEach(function(effect) {
                        if (effect.dpsRelevant === false) return;

                        var effectName = effect.name || '';
                        var value = effect.value || 0;

                        var effectWeight = getEffectWeightWithFallback(effectName);
                        var roleWeight = multipliers[effectName] || defaultRoleWeight;

                        // 스텟 보정 적용
                        var statMultiplier = 1.0;
                        if (effectName.indexOf('치명타 확률') !== -1) {
                            statMultiplier *= statAdjustments.critMarginalUtility;
                        }
                        if (effectName.indexOf('공격력') !== -1) {
                            statMultiplier *= statAdjustments.attackBalanceMultiplier;
                        }
                        if (effectName.indexOf('피해량') !== -1) {
                            statMultiplier *= statAdjustments.damageBalanceMultiplier;
                        }

                        // 클래스별 우선 효과 보너스
                        var classBonus = 1.0;
                        if (statAdjustments.classPriorityEffects && statAdjustments.classPriorityEffects.length > 0) {
                            var isPriorityEffect = statAdjustments.classPriorityEffects.some(function(priority) {
                                return effectName.indexOf(priority) !== -1;
                            });
                            if (isPriorityEffect) classBonus = 1.25;
                        }

                        score += value * effectWeight * roleWeight * statMultiplier * classBonus;
                    });
                }
            });
        }

        // ========================================
        // 4. 등급 보너스 (GameConstants 모듈 사용)
        // @updated 2025-12-11 - 매직넘버를 상수로 대체
        // ========================================
        var gradeName = rune.gradeName || '';
        var gradeBonus = (Modules.GameConstants && Modules.GameConstants.GRADE_BONUS_BY_NAME)
            ? Modules.GameConstants.GRADE_BONUS_BY_NAME
            : { '신화': 100, '전설(시즌1)': 70, '전설(시즌0)': 50, '유니크(시즌0)': 30 };
        score += gradeBonus[gradeName] || 0;

        // ========================================
        // 5. 시너지 보너스 (DoT 부여) (GameConstants 모듈 사용)
        // @updated 2025-12-11 - 매직넘버를 상수로 대체
        // ========================================
        var synergyBonus = (Modules.GameConstants && Modules.GameConstants.SYNERGY_BONUS)
            ? Modules.GameConstants.SYNERGY_BONUS
            : { DOT_APPLY_PER_TYPE: 15 };

        if (rune.synergy && rune.synergy.appliesDot && rune.synergy.appliesDot.length > 0) {
            score += rune.synergy.appliesDot.length * synergyBonus.DOT_APPLY_PER_TYPE;
        }

        // ========================================
        // 6. 각성 효과 (엠블럼 룬) (GameConstants 모듈 사용)
        // @updated 2025-12-11 - 매직넘버를 상수로 대체
        // ========================================
        if (rune.awakening && rune.awakening.effects) {
            var awakeningConst = (Modules.GameConstants && Modules.GameConstants.AWAKENING_CONSTANTS)
                ? Modules.GameConstants.AWAKENING_CONSTANTS
                : { BASE_COOLDOWN: 90, DEFAULT_DURATION: 20, MIN_COOLDOWN: 30 };

            var duration = rune.awakening.duration || awakeningConst.DEFAULT_DURATION;
            var uptime;

            // StatFormulas 모듈로 각성 업타임 계산
            if (Modules.StatFormulas && Modules.StatFormulas.calculateAwakeningUptime) {
                uptime = Modules.StatFormulas.calculateAwakeningUptime(duration, awakeningCooldownReduction);
            } else {
                var adjustedCooldown = Math.max(awakeningConst.BASE_COOLDOWN - awakeningCooldownReduction, awakeningConst.MIN_COOLDOWN);
                uptime = duration / (duration + adjustedCooldown);
            }

            rune.awakening.effects.forEach(function(effect) {
                if (effect.dpsRelevant === false) return;

                var effectName = effect.name || '';
                var value = effect.value || 0;

                var effectWeight = getEffectWeightWithFallback(effectName);
                var roleWeight = multipliers[effectName] || defaultRoleWeight;

                // 스텟 보정 적용
                var statMultiplier = 1.0;
                if (effectName.indexOf('치명타 확률') !== -1) {
                    statMultiplier *= statAdjustments.critMarginalUtility;
                }
                if (effectName.indexOf('공격력') !== -1) {
                    statMultiplier *= statAdjustments.attackBalanceMultiplier;
                }
                if (effectName.indexOf('피해량') !== -1) {
                    statMultiplier *= statAdjustments.damageBalanceMultiplier;
                }

                // 클래스별 우선 효과 보너스
                var classBonus = 1.0;
                if (statAdjustments.classPriorityEffects && statAdjustments.classPriorityEffects.length > 0) {
                    var isPriorityEffect = statAdjustments.classPriorityEffects.some(function(priority) {
                        return effectName.indexOf(priority) !== -1;
                    });
                    if (isPriorityEffect) classBonus = 1.25;
                }

                score += value * effectWeight * roleWeight * uptime * statMultiplier * classBonus;
            });
        }

        return Math.round(score * 10) / 10;
    }

    // ========================================
    // Web Worker 인스턴스 (전역)
    // @added 2025-12-11 - Branch & Bound 최적화 (병렬 Worker)
    // ========================================
    let optimizationWorkers = [];  // 병렬 Worker 배열
    let workerResults = [];        // 각 Worker의 결과
    let workerProgress = [];       // 각 Worker의 진행률
    let totalWorkersCompleted = 0; // 완료된 Worker 수
    let parallelStartTime = null;  // 병렬 처리 시작 시간

    /**
     * 최적화 진행률 UI 업데이트 (2단계 탐색 지원)
     * @param {Object} data - 진행률 데이터
     * @updated 2025-12-11 - 2단계 탐색 및 실시간 최적 조합 표시 추가
     */
    function updateProgressUI(data) {
        const progressEl = $('#optimization-progress');
        const percentEl = $('#progress-percent');
        const barEl = $('#progress-bar');
        const processedEl = $('#progress-processed');
        const totalEl = $('#progress-total');
        const remainingEl = $('#progress-remaining');
        const titleEl = $('#progress-title');
        
        // 단계 상태 요소
        const phase1Status = $('#phase-1-status');
        const phase2Status = $('#phase-2-status');
        
        // 미리보기 요소
        const previewEl = $('#current-best-preview');
        const previewScoreEl = $('#preview-score');
        const previewWeaponEl = $('#preview-weapon');
        const previewArmorsEl = $('#preview-armors');
        const previewEmblemEl = $('#preview-emblem');
        const previewAccessoriesEl = $('#preview-accessories');

        if (progressEl) progressEl.style.display = 'block';
        if (percentEl) percentEl.textContent = data.progress + '%';
        if (barEl) barEl.style.width = data.progress + '%';
        if (processedEl) processedEl.textContent = '계산: ' + (data.processed || 0).toLocaleString();
        if (totalEl) totalEl.textContent = '/ ' + (data.total || 0).toLocaleString();
        
        // 단계별 타이틀 업데이트
        if (titleEl) {
            if (data.phase === 1) {
                titleEl.textContent = '🔍 1단계: 빠른 탐색 중...';
            } else if (data.phase === 2) {
                titleEl.textContent = '🔬 2단계: 정밀 확장 탐색 중...';
            }
        }
        
        // 단계 상태 업데이트
        if (data.phase === 1) {
            if (phase1Status) {
                phase1Status.classList.add('phase-active');
                phase1Status.classList.remove('phase-complete');
                phase1Status.querySelector('.phase-icon').textContent = '⏳';
            }
            if (phase2Status) {
                phase2Status.classList.remove('phase-active', 'phase-complete');
                phase2Status.querySelector('.phase-icon').textContent = '⏸️';
            }
        } else if (data.phase === 2) {
            if (phase1Status) {
                phase1Status.classList.remove('phase-active');
                phase1Status.classList.add('phase-complete');
                phase1Status.querySelector('.phase-icon').textContent = '✅';
            }
            if (phase2Status) {
                phase2Status.classList.add('phase-active');
                phase2Status.classList.remove('phase-complete');
                phase2Status.querySelector('.phase-icon').textContent = '⏳';
            }
        }
        
        // 남은 시간 표시
        if (remainingEl) {
            if (data.estimatedRemaining && data.estimatedRemaining > 0) {
                const mins = Math.floor(data.estimatedRemaining / 60);
                const secs = data.estimatedRemaining % 60;
                remainingEl.textContent = '예상: ' + 
                    (mins > 0 ? mins + '분 ' : '') + secs + '초';
            } else {
                remainingEl.textContent = '예상: 계산 중...';
            }
        }
        
        // 현재 최적 조합 미리보기 업데이트
        if (data.bestCombination && data.bestScore > 0) {
            if (previewEl) previewEl.style.display = 'block';
            if (previewScoreEl) previewScoreEl.textContent = '점수: ' + data.bestScore.toFixed(1) + '점';
            
            const combo = data.bestCombination;
            if (previewWeaponEl && combo.weapon) {
                previewWeaponEl.textContent = combo.weapon.name;
            }
            if (previewArmorsEl && combo.armors) {
                previewArmorsEl.textContent = combo.armors.map(a => a.name).join(', ');
            }
            if (previewEmblemEl && combo.emblem) {
                previewEmblemEl.textContent = combo.emblem.name;
            }
            if (previewAccessoriesEl && combo.accessories) {
                previewAccessoriesEl.textContent = combo.accessories.map(a => a.name).join(', ');
            }
        }
    }

    /**
     * 최적화 완료 처리
     * @param {Object} result - 최적화 결과
     * @updated 2025-12-11 - 2단계 탐색 지원
     */
    function handleOptimizationComplete(result) {
        const elapsed = parallelStartTime ? ((Date.now() - parallelStartTime) / 1000).toFixed(1) : 0;
        
        console.log('✅ 최적화 완료:', {
            최고점수: result.bestScore,
            계산수: (result.processed || 0).toLocaleString(),
            소요시간: elapsed + '초'
        });

        // 진행률 UI 숨기기
        const progressEl = $('#optimization-progress');
        if (progressEl) progressEl.style.display = 'none';

        // 버튼 상태 복원
        const btnRecommend = $('#btn-recommend');
        const btnStop = $('#btn-stop-recommend');
        if (btnRecommend) {
            btnRecommend.disabled = false;
            btnRecommend.textContent = '🎯 최적 룬 조합 추천받기';
        }
        if (btnStop) btnStop.style.display = 'none';

        // 결과가 없으면
        if (!result.bestCombination) {
            showToast('최적 조합을 찾을 수 없습니다.', 'error');
            return;
        }

        // 결과 표시
        displayOptimizationResult(result);
        showToast(`최적 조합 탐색 완료! (${elapsed}초 소요)`, 'success');
    }

    /**
     * 최적화 결과 표시
     * @param {Object} result - 최적화 결과
     * @added 2025-12-11
     * @updated 2025-12-11 - recommend-rune-item 클래스 구조로 변경
     */
    function displayOptimizationResult(result) {
        const { bestCombination, bestScore, processed, skipped, total } = result;
        const resultEl = $('#recommend-result');
        
        if (!resultEl) return;

        // 스킵률 계산
        const skipRate = processed + skipped > 0 
            ? Math.round((skipped / (processed + skipped)) * 100) 
            : 0;

        // 카테고리별 결과 정리
        const recommendations = {
            '01': {
                name: '⚔️ 무기 룬',
                slots: ['weapon-1'],
                runes: [bestCombination.weapon]
            },
            '02': {
                name: '🛡️ 방어구 룬',
                slots: ['armor-1', 'armor-2', 'armor-3', 'armor-4', 'armor-5'],
                runes: bestCombination.armors
            },
            '04': {
                name: '🔥 엠블럼 룬',
                slots: ['emblem-1'],
                runes: [bestCombination.emblem]
            },
            '03': {
                name: '💍 장신구 룬',
                slots: ['accessory-1', 'accessory-2', 'accessory-3'],
                runes: bestCombination.accessories
            }
        };

        // HTML 생성
        let html = `
            <div class="recommend-header" style="text-align:center;margin-bottom:20px;">
                <h2 class="section-title" style="color:#FFD700;">🎯 추천 룬 조합</h2>
                <div class="recommend-total-score" style="font-size:24px;font-weight:bold;color:#4CAF50;">
                    총 효율 점수: ${bestScore.toFixed(1)}점
                </div>
                <div class="optimization-stats" style="font-size:12px;color:#888;margin-top:8px;">
                    가지치기 알고리즘으로 ${skipRate}% 계산 스킵 | 
                    ${(processed || 0).toLocaleString()}개 조합 분석
                </div>
            </div>
        `;

        const categoryOrder = ['01', '02', '04', '03'];
        categoryOrder.forEach(categoryCode => {
            const rec = recommendations[categoryCode];
            if (!rec || !rec.runes || rec.runes.length === 0) return;

            html += `
                <div class="recommend-category" style="margin-bottom:20px;">
                    <h3 class="recommend-category__title" style="color:#FFD700;margin-bottom:10px;font-size:16px;">${rec.name}</h3>
                    <div class="recommend-runes">
            `;

            rec.runes.forEach((rune, index) => {
                if (!rune) return;
                
                const slotId = rec.slots[index];
                const gradeInfo = getGradeInfo(rune) || { name: '??', color: 'gray' };
                
                // 효과 요약 생성
                let effectSummary = '';
                if (rune.effects && rune.effects.length > 0) {
                    effectSummary = rune.effects.slice(0, 2).map(e => {
                        const name = e.name || '';
                        const value = e.value || 0;
                        return `${name} +${value}%`;
                    }).join(', ');
                    if (rune.effects.length > 2) {
                        effectSummary += ' 외 ' + (rune.effects.length - 2) + '개';
                    }
                }

                html += `
                    <div class="recommend-rune-item" data-rune-id="${rune.id}" data-slot="${slotId}" style="cursor:pointer;">
                        <img class="recommend-rune-item__image" 
                             src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                             alt="${escapeHtml(rune.name)}"
                             onerror="handleRuneImageError(this)">
                        <div class="recommend-rune-item__info">
                            <div class="recommend-rune-item__name">
                                ${escapeHtml(rune.name)}
                                <span class="recommend-rune-item__grade" style="color:${rune.gradeColor || '#FFD700'};font-size:12px;margin-left:6px;">[${gradeInfo.name}]</span>
                            </div>
                            <div class="recommend-rune-item__effect">${effectSummary || '효과 정보 없음'}</div>
                        </div>
                        <div class="recommend-rune-item__score">
                            <span class="recommend-rune-item__score-label">효율 점수</span>
                            <span class="recommend-rune-item__score-value">${(rune.baseScore || rune.maxScore || 0).toFixed(0)}</span>
                        </div>
                        <button class="btn btn--sm btn--primary recommend-equip-btn" style="margin-left:10px;">장착</button>
                    </div>
                `;
            });

            html += '</div></div>';
        });

        resultEl.innerHTML = html;

        // 장착 버튼 이벤트 연결
        $$('.recommend-equip-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation(); // 상세 모달 열림 방지
                const item = this.closest('.recommend-rune-item');
                const runeId = parseInt(item.dataset.runeId);
                const slotId = item.dataset.slot;
                
                const rune = state.allRunes.find(r => r.id === runeId);
                if (rune && slotId) {
                    equipRuneToSlot(rune, slotId);
                    showToast(rune.name + ' 장착 완료!', 'success');
                }
            });
        });

        // 룬 클릭 시 상세 모달 (장착 버튼 제외)
        $$('.recommend-rune-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.recommend-equip-btn')) return;
                const runeId = parseInt(this.dataset.runeId);
                if (runeId) openRuneDetailModal(runeId);
            });
        });
    }

    /**
     * 최적화 탐색 중단
     * @added 2025-12-11
     */
    function stopOptimization() {
        // 모든 병렬 Worker 종료
        if (optimizationWorkers && optimizationWorkers.length > 0) {
            console.log('⏹️ 병렬 Worker 중단:', optimizationWorkers.length + '개');
            optimizationWorkers.forEach(function(worker) {
                worker.terminate();
            });
            optimizationWorkers = [];
            workerResults = [];
            workerProgress = [];
            totalWorkersCompleted = 0;
            
            const progressEl = $('#optimization-progress');
            if (progressEl) progressEl.style.display = 'none';

            const btnRecommend = $('#btn-recommend');
            const btnStop = $('#btn-stop-recommend');
            if (btnRecommend) {
                btnRecommend.disabled = false;
                btnRecommend.textContent = '🎯 최적 룬 조합 추천받기';
            }
            if (btnStop) btnStop.style.display = 'none';

            showToast('탐색이 중단되었습니다.', 'warning');
        }
    }

    /**
     * 최적 룬 추천 실행 (Web Worker 사용)
     * @updated 2025-12-11 - Branch & Bound 알고리즘으로 전면 재설계
     */
    function runRecommendation() {
        console.warn('🎯 추천 시작 (Branch & Bound 알고리즘)...');
        console.log('📊 전체 룬 수:', state.allRunes.length);
        
        // 디버그 플래그 초기화
        window._runeScoreDebugLogged = false;

        // 데이터 로드 확인
        if (!state.allRunes || state.allRunes.length === 0) {
            showToast('룬 데이터가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.', 'error');
            console.error('❌ 룬 데이터 없음: state.allRunes가 비어있습니다.');
            return;
        }

        // ========================================
        // 스텟 수집 (HTML 입력 필드에서)
        // @updated 2025-12-11 - 세부 스텟 추가 (치명타, 추가타 등)
        // ========================================

        // 헬퍼 함수: 입력 필드 값 가져오기
        // 스텟 기본값 (GameConstants 모듈 사용)
        // @updated 2025-12-11 - 기본값 0에서 1로 변경 (0으로 나누기 방지)
        var statDefault = (Modules.GameConstants && Modules.GameConstants.STAT_DEFAULTS)
            ? Modules.GameConstants.STAT_DEFAULTS.INPUT_DEFAULT
            : 1;

        function getStatValue(id) {
            var el = $('#' + id);
            var value = parseInt(el ? el.value : 0) || 0;
            // 값이 0이거나 비어있으면 기본값 사용
            return value > 0 ? value : statDefault;
        }

        const stats = {
            // 5대 기본 스텟
            str: getStatValue('stat-str'),
            dex: getStatValue('stat-dex'),
            int: getStatValue('stat-int'),
            wil: getStatValue('stat-wil'),
            luk: getStatValue('stat-luk'),

            // 주요 스텟
            atk: getStatValue('stat-atk'),
            def: getStatValue('stat-def'),

            // 세부 스텟 (효율 계산에 사용)
            critical: getStatValue('stat-crit'),           // 치명타 스텟
            additionalHit: getStatValue('stat-extra'),     // 추가타 스텟
            heavyHit: getStatValue('stat-smash'),          // 강타 강화 스텟
            comboHit: getStatValue('stat-chain'),          // 연타 강화 스텟
            skillPower: getStatValue('stat-skill'),        // 스킬 위력 스텟

            // 현재 장착 룬에서 계산된 보너스 (%) - 동적 계산
            // @description 추천 시 현재 장착된 룬의 효과를 반영하여 한계효용/밸런스 계산
            attackBonus: 0,
            damageBonus: 0,
            critRateBonus: 0
        };

        // 현재 장착된 룬에서 보너스 수집
        // @added 2025-12-11 - 공격력/피해량 밸런스 및 치명타 한계효용 계산용
        if (state.equippedRunes) {
            Object.values(state.equippedRunes).forEach(function(rune) {
                if (!rune || !rune.effects) return;

                rune.effects.forEach(function(effect) {
                    var name = effect.name || '';
                    var value = effect.value || 0;

                    if (name.indexOf('공격력') !== -1 && name.indexOf('증가') !== -1) {
                        stats.attackBonus += value;
                    }
                    if ((name.indexOf('피해량') !== -1 || name === '적에게 주는 피해') && name.indexOf('증가') !== -1) {
                        stats.damageBonus += value;
                    }
                    if (name.indexOf('치명타 확률') !== -1) {
                        stats.critRateBonus += value;
                    }
                });
            });
        }

        // 역할 및 클래스 정보 수집
        var roleEl = $('#recommend-role');
        var classEl = $('#recommend-class');
        var gradeEl = $('#recommend-min-grade');

        const role = (roleEl ? roleEl.value : null) || 'dealer';
        const selectedClass = (classEl ? classEl.value : null) || '00';

        // 클래스 정보를 stats에 추가 (효율 계산에서 사용)
        // @updated 2025-12-11 - 클래스 코드 직접 전달 (역조회 제거)
        stats.classCode = selectedClass;
        stats.className = getClassNameByCode(selectedClass);
        stats.role = role;

        // 상세 로그 출력
        console.log('📊 수집된 스텟 (입력값):', {
            힘: stats.str,
            솜씨: stats.dex,
            지력: stats.int,
            의지: stats.wil,
            행운: stats.luk,
            공격력: stats.atk,
            치명타: stats.critical,
            추가타: stats.additionalHit,
            강타강화: stats.heavyHit,
            연타강화: stats.comboHit,
            스킬위력: stats.skillPower
        });

        console.log('📊 현재 보너스 (장착 룬에서):', {
            공격력보너스: stats.attackBonus + '%',
            피해량보너스: stats.damageBonus + '%',
            치명타확률보너스: stats.critRateBonus + '%'
        });

        // 클래스별 우선 효과 조회 및 로그 출력
        var classPriorityEffects = [];
        var classSubStatType = null;
        if (selectedClass !== '00') {
            classSubStatType = getClassSubStatType(selectedClass);
            classPriorityEffects = getClassPriorityEffects(selectedClass);
        }

        console.log('🎮 선택된 옵션:', {
            역할: role,
            클래스: stats.className || '전체',
            클래스코드: selectedClass,
            SubStat타입: classSubStatType || '없음',
            우선효과: classPriorityEffects.length > 0 ? classPriorityEffects : '없음'
        });
        const minGrade = (gradeEl ? gradeEl.value : null) || '4'; // priority 기반 (4 = 전설(시즌0) 이상)

        // ========================================
        // Web Worker를 사용한 최적화 탐색
        // @added 2025-12-11 - Branch & Bound 알고리즘
        // ========================================

        // 카테고리별 룬 필터링
        // @updated 2025-12-11 - 클래스 이름/코드 모두 비교
        var selectedClassName = getClassNameByCode(selectedClass);
        var shortClassName = selectedClassName ? selectedClassName.split(' ')[0] : '';
        
        console.log('🔍 클래스 필터 정보:', {
            selectedClass: selectedClass,
            selectedClassName: selectedClassName,
            shortClassName: shortClassName
        });

        function filterRunesByCategory(categoryCode) {
            try {
                var filtered = [];
                var excluded = [];
                
                state.allRunes.forEach(function(rune) {
                    // 카테고리 필터
                    if (rune.category !== categoryCode) return;
                    
                    // @updated 2025-12-11 - effects 배열 체크 완전 제거
                    
                    // 등급 필터 - 무기/방어구/엠블럼은 등급 필터 비활성화
                    // @updated 2025-12-11 - 등급 필터 완전 비활성화 (모든 룬 포함)
                    // 장신구(03)만 클래스 필터 적용
                    
                    // 클래스 필터 (장신구만 적용)
                    if (categoryCode === '03' && selectedClass !== '00') {
                        var runeClass = rune.classRestriction || rune.klass || null;
                        
                        // 클래스 제한이 없는 룬(null)은 모든 클래스에서 사용 가능
                        if (runeClass === null || runeClass === '00' || runeClass === '전체') {
                            // 통과
                        } else if (runeClass === selectedClass) {
                            // 클래스 코드 일치
                        } else if (runeClass === selectedClassName || runeClass === shortClassName) {
                            // 클래스 이름 일치
                        } else if (shortClassName && runeClass && runeClass.indexOf(shortClassName) !== -1) {
                            // 부분 문자열 일치
                        } else {
                            excluded.push({ name: rune.name, reason: 'class', runeClass: runeClass });
                            return;
                        }
                    }
                    
                    filtered.push(rune);
                });
                
                // 디버그: 필터링 결과
                if (excluded.length > 0 && categoryCode === '03') {
                    console.log('🚫 장신구 클래스 필터링:', excluded.length + '개 제외');
                }
                
                return filtered;
            } catch (error) {
                console.error('필터링 오류:', categoryCode, error);
                return [];
            }
        }

        // 룬 데이터 준비
        var weapons, armors, emblems, accessories;
        try {
            weapons = filterRunesByCategory('01');
            armors = filterRunesByCategory('02');
            emblems = filterRunesByCategory('04');
            accessories = filterRunesByCategory('03');
        } catch (error) {
            console.error('룬 필터링 중 오류:', error);
            showToast('룬 필터링 중 오류가 발생했습니다.', 'error');
            return;
        }

        console.log('📊 원본 필터링된 룬 수:', {
            무기: weapons.length,
            방어구: armors.length,
            엠블럼: emblems.length,
            장신구: accessories.length
        });

        // ========================================
        // Top-N 필터링 (2단계 탐색 최적화)
        // @added 2025-12-11 - 각 기준 상위 10개씩 선정
        // ========================================
        const TOP_N = 10;
        
        function filterTopN(runes, topN) {
            if (!runes || runes.length <= topN * 2) return runes;
            
            // 점수가 없으면 임시 계산
            const scoredRunes = runes.map(function(rune) {
                if (rune.baseScore === undefined) {
                    // 간단한 점수 계산
                    let score = 0;
                    if (rune.effects) {
                        rune.effects.forEach(function(e) {
                            score += (e.value || 0) * 0.7;
                        });
                    }
                    if (rune.demerits) {
                        rune.demerits.forEach(function(d) {
                            score -= (d.value || 0) * 0.5;
                        });
                    }
                    rune.baseScore = score;
                    rune.maxScore = score * 1.5;
                }
                return rune;
            });
            
            // baseScore 정렬
            const byBase = [...scoredRunes].sort(function(a, b) {
                return (b.baseScore || 0) - (a.baseScore || 0);
            });
            
            // maxScore 정렬
            const byMax = [...scoredRunes].sort(function(a, b) {
                return (b.maxScore || 0) - (a.maxScore || 0);
            });
            
            // 상위 N개씩 선정 (중복 제거)
            const selectedIds = new Set();
            const result = [];
            
            for (let i = 0; i < Math.min(topN, byBase.length); i++) {
                if (!selectedIds.has(byBase[i].id)) {
                    selectedIds.add(byBase[i].id);
                    result.push(byBase[i]);
                }
            }
            
            for (let i = 0; i < Math.min(topN, byMax.length); i++) {
                if (!selectedIds.has(byMax[i].id)) {
                    selectedIds.add(byMax[i].id);
                    result.push(byMax[i]);
                }
            }
            
            return result.sort(function(a, b) {
                return (b.maxScore || 0) - (a.maxScore || 0);
            });
        }
        
        // Top-N 필터링 적용
        const filteredWeapons = filterTopN(weapons, TOP_N);
        const filteredArmors = filterTopN(armors, TOP_N);
        // 엠블럼/장신구는 개수가 적으므로 전체 유지
        const filteredEmblems = emblems;
        const filteredAccessories = accessories;
        
        console.log('📊 Top-N 필터링 후 룬 수:', {
            무기: filteredWeapons.length + '/' + weapons.length,
            방어구: filteredArmors.length + '/' + armors.length,
            엠블럼: filteredEmblems.length,
            장신구: filteredAccessories.length
        });

        // 디버그: 필터링 실패 원인 분석
        if (weapons.length === 0 || armors.length < 5 || emblems.length === 0 || accessories.length < 3) {
            console.error('❌ 룬 필터링 실패 분석:');
            console.log('  - 전체 룬 수:', state.allRunes.length);
            console.log('  - minGrade:', minGrade);
            console.log('  - selectedClass:', selectedClass);
            
            // 카테고리별 원본 수 확인
            var catCounts = {};
            state.allRunes.forEach(function(r) {
                catCounts[r.category] = (catCounts[r.category] || 0) + 1;
            });
            console.log('  - 카테고리별 원본 룬 수:', catCounts);
            
            // 샘플 룬 확인
            var sampleRune = state.allRunes[0];
            if (sampleRune) {
                console.log('  - 샘플 룬:', {
                    name: sampleRune.name,
                    category: sampleRune.category,
                    gradeName: sampleRune.gradeName,
                    effects: sampleRune.effects ? sampleRune.effects.length : 0,
                    gradeInfo: getGradeInfo(sampleRune)
                });
            }
            
            showToast('선택 조건에 맞는 룬이 부족합니다. 콘솔을 확인하세요.', 'error');
            return;
        }

        // UI 업데이트
        const btnRecommend = $('#btn-recommend');
        const btnStop = $('#btn-stop-recommend');
        if (btnRecommend) {
            btnRecommend.disabled = true;
            btnRecommend.textContent = '🔄 탐색 중...';
        }
        if (btnStop) btnStop.style.display = 'inline-block';

        // 진행률 UI 초기화
        updateProgressUI({
            phase: 1,
            progress: 0,
            processed: 0,
            total: 0,
            bestScore: 0,
            estimatedRemaining: 0,
            bestCombination: null
        });

        // 병렬 Web Worker 생성 및 실행 (Top-N 필터링 적용)
        // @updated 2025-12-11 - Top-N 필터링 + 기존 가지치기 병렬 실행
        try {
            // CPU 코어 수 기반 Worker 수 결정 (최대 8개, 최소 2개)
            const numCores = navigator.hardwareConcurrency || 4;
            const numWorkers = Math.min(Math.max(2, numCores), 8, filteredWeapons.length);
            
            console.log(`🚀 병렬 Worker 시작: ${numWorkers}개 (CPU 코어: ${numCores})`);
            
            // 초기화
            optimizationWorkers = [];
            workerResults = [];
            workerProgress = new Array(numWorkers).fill(null).map(() => ({ processed: 0, skipped: 0, bestScore: 0 }));
            totalWorkersCompleted = 0;
            parallelStartTime = Date.now();
            
            // 현재 최적 조합 저장 (실시간 업데이트용)
            let currentBestCombination = null;
            
            // 무기를 Worker 수로 분할
            const weaponsPerWorker = Math.ceil(filteredWeapons.length / numWorkers);
            
            // 총 조합 수 계산
            function nCr(n, r) {
                if (r > n) return 0;
                if (r === 0 || r === n) return 1;
                let result = 1;
                for (let i = 0; i < r; i++) {
                    result = (result * (n - i)) / (i + 1);
                }
                return Math.round(result);
            }
            const totalCombinations = filteredWeapons.length * nCr(filteredArmors.length, 5) * filteredEmblems.length * nCr(filteredAccessories.length, 3);
            
            console.log(`📊 총 조합 수: ${totalCombinations.toLocaleString()} (Top-N 필터링 적용)`);
            
            // 각 Worker 생성
            for (let i = 0; i < numWorkers; i++) {
                const worker = new Worker('formulas/combination-worker.js');
                const weaponStartIdx = i * weaponsPerWorker;
                const weaponEndIdx = Math.min((i + 1) * weaponsPerWorker, filteredWeapons.length);
                
                worker.onmessage = function(e) {
                    const { type, workerId, ...data } = e.data;
                    
                    if (type === 'progress') {
                        // 해당 Worker의 진행률 업데이트
                        workerProgress[workerId] = data;
                        
                        // 전체 진행률 계산
                        let totalProcessed = 0;
                        let totalSkipped = 0;
                        let globalBestScore = 0;
                        
                        workerProgress.forEach(function(p) {
                            if (p) {
                                totalProcessed += p.processed || 0;
                                totalSkipped += p.skipped || 0;
                                if (p.bestScore > globalBestScore) {
                                    globalBestScore = p.bestScore;
                                }
                            }
                        });
                        
                        const elapsed = (Date.now() - parallelStartTime) / 1000;
                        const progress = (totalProcessed + totalSkipped) / totalCombinations;
                        const estimatedRemaining = progress > 0 ? (elapsed / progress) * (1 - progress) : 0;
                        
                        updateProgressUI({
                            phase: 1,
                            processed: totalProcessed,
                            skipped: totalSkipped,
                            total: totalCombinations,
                            progress: Math.round(progress * 100),
                            bestScore: globalBestScore,
                            estimatedRemaining: Math.round(estimatedRemaining),
                            bestCombination: currentBestCombination
                        });
                        
                        // 새로운 최적 조합 발견 시 저장
                        if (data.bestCombination && data.bestScore > (currentBestCombination ? currentBestCombination.score : 0)) {
                            currentBestCombination = data.bestCombination;
                            currentBestCombination.score = data.bestScore;
                        }
                        
                    } else if (type === 'complete') {
                        // Worker 완료
                        workerResults[workerId] = data;
                        totalWorkersCompleted++;
                        
                        console.log(`✅ Worker ${workerId + 1}/${numWorkers} 완료 - 점수: ${data.bestScore}, 스킵: ${data.skipped}`);
                        
                        // 모든 Worker 완료 확인
                        if (totalWorkersCompleted >= numWorkers) {
                            // 최고 점수 찾기
                            let globalBest = { bestScore: 0, bestCombination: null };
                            let totalProcessed = 0;
                            let totalSkipped = 0;
                            
                            workerResults.forEach(function(result) {
                                if (result) {
                                    totalProcessed += result.processed || 0;
                                    totalSkipped += result.skipped || 0;
                                    if (result.bestScore > globalBest.bestScore) {
                                        globalBest = result;
                                    }
                                }
                            });
                            
                            const elapsed = (Date.now() - parallelStartTime) / 1000;
                            const skipRate = totalProcessed + totalSkipped > 0 
                                ? Math.round((totalSkipped / (totalProcessed + totalSkipped)) * 100) 
                                : 0;
                            
                            console.log(`🏁 1단계 완료! 소요시간: ${elapsed.toFixed(1)}초, 최고점수: ${globalBest.bestScore}, 스킵률: ${skipRate}%`);
                            showToast(`1단계 완료! 점수: ${globalBest.bestScore.toFixed(1)}점 (${elapsed.toFixed(1)}초)`, 'success');
                            
                            // Worker 정리
                            optimizationWorkers.forEach(function(w) { w.terminate(); });
                            optimizationWorkers = [];
                            
                            // ========================================
                            // 2단계: 확장 탐색 (1단계 결과 기반 ±5등 확장)
                            // @added 2025-12-11
                            // ========================================
                            const EXPAND_RANGE = 5;
                            
                            // 1단계에서 선택된 룬 ID 수집
                            const phase1Best = globalBest.bestCombination;
                            const selectedWeaponIds = new Set();
                            const selectedArmorIds = new Set();
                            
                            if (phase1Best) {
                                if (phase1Best.weapon) selectedWeaponIds.add(phase1Best.weapon.id);
                                if (phase1Best.armors) phase1Best.armors.forEach(function(a) { selectedArmorIds.add(a.id); });
                            }
                            
                            // 1단계 Top-N 룬들도 포함
                            filteredWeapons.forEach(function(w) { selectedWeaponIds.add(w.id); });
                            filteredArmors.forEach(function(a) { selectedArmorIds.add(a.id); });
                            
                            // ±5등 확장 함수
                            function expandSelection(selectedIds, allRunes, expandRange) {
                                // 점수 기준 정렬
                                const sorted = [...allRunes].sort(function(a, b) {
                                    return (b.maxScore || b.baseScore || 0) - (a.maxScore || a.baseScore || 0);
                                });
                                
                                const expandedIds = new Set(selectedIds);
                                const selectedIndices = [];
                                
                                sorted.forEach(function(rune, idx) {
                                    if (selectedIds.has(rune.id)) {
                                        selectedIndices.push(idx);
                                    }
                                });
                                
                                selectedIndices.forEach(function(idx) {
                                    for (let i = Math.max(0, idx - expandRange); i <= Math.min(sorted.length - 1, idx + expandRange); i++) {
                                        expandedIds.add(sorted[i].id);
                                    }
                                });
                                
                                return sorted.filter(function(rune) { return expandedIds.has(rune.id); });
                            }
                            
                            // 확장된 룬 목록 생성
                            const phase2Weapons = expandSelection(selectedWeaponIds, weapons, EXPAND_RANGE);
                            const phase2Armors = expandSelection(selectedArmorIds, armors, EXPAND_RANGE);
                            
                            console.log(`🔬 2단계 확장: 무기 ${filteredWeapons.length}→${phase2Weapons.length}, 방어구 ${filteredArmors.length}→${phase2Armors.length}`);
                            
                            // 2단계 조합 수 계산
                            const phase2Total = phase2Weapons.length * nCr(phase2Armors.length, 5) * filteredEmblems.length * nCr(filteredAccessories.length, 3);
                            
                            // 확장이 의미없으면 (동일하거나 더 작으면) 바로 완료
                            if (phase2Weapons.length <= filteredWeapons.length && phase2Armors.length <= filteredArmors.length) {
                                console.log('ℹ️ 2단계 확장 불필요 - 1단계 결과 사용');
                                handleOptimizationComplete({
                                    bestScore: globalBest.bestScore,
                                    bestCombination: globalBest.bestCombination,
                                    processed: totalProcessed,
                                    skipped: totalSkipped,
                                    total: totalCombinations
                                });
                                return;
                            }
                            
                            // UI 업데이트
                            updateProgressUI({
                                phase: 2,
                                progress: 0,
                                processed: 0,
                                total: phase2Total,
                                bestScore: globalBest.bestScore,
                                estimatedRemaining: 0,
                                bestCombination: phase1Best
                            });
                            
                            showToast('2단계: 정밀 확장 탐색 시작...', 'info');
                            
                            // 2단계 Worker 생성
                            const phase2StartTime = Date.now();
                            const numPhase2Workers = Math.min(Math.max(2, numCores), 8, phase2Weapons.length);
                            const weaponsPerPhase2Worker = Math.ceil(phase2Weapons.length / numPhase2Workers);
                            
                            let phase2Best = globalBest;
                            let phase2WorkersCompleted = 0;
                            let phase2Results = [];
                            let phase2Progress = new Array(numPhase2Workers).fill(null).map(function() { return { processed: 0, skipped: 0, bestScore: 0 }; });
                            
                            for (let i = 0; i < numPhase2Workers; i++) {
                                const worker = new Worker('formulas/combination-worker.js');
                                const weaponStartIdx = i * weaponsPerPhase2Worker;
                                const weaponEndIdx = Math.min((i + 1) * weaponsPerPhase2Worker, phase2Weapons.length);
                                const workerWeapons = phase2Weapons.slice(weaponStartIdx, weaponEndIdx);
                                
                                if (workerWeapons.length === 0) {
                                    phase2WorkersCompleted++;
                                    continue;
                                }
                                
                                worker.onmessage = function(e) {
                                    const { type, workerId: wId, ...wData } = e.data;
                                    
                                    if (type === 'progress') {
                                        phase2Progress[wId] = wData;
                                        
                                        let p2TotalProcessed = 0;
                                        let p2TotalSkipped = 0;
                                        let p2GlobalBestScore = phase2Best.bestScore;
                                        
                                        phase2Progress.forEach(function(p) {
                                            if (p) {
                                                p2TotalProcessed += p.processed || 0;
                                                p2TotalSkipped += p.skipped || 0;
                                                if (p.bestScore > p2GlobalBestScore) {
                                                    p2GlobalBestScore = p.bestScore;
                                                }
                                            }
                                        });
                                        
                                        const p2Elapsed = (Date.now() - phase2StartTime) / 1000;
                                        const p2Progress = (p2TotalProcessed + p2TotalSkipped) / phase2Total;
                                        const p2Remaining = p2Progress > 0 ? (p2Elapsed / p2Progress) * (1 - p2Progress) : 0;
                                        
                                        updateProgressUI({
                                            phase: 2,
                                            processed: p2TotalProcessed,
                                            skipped: p2TotalSkipped,
                                            total: phase2Total,
                                            progress: Math.round(p2Progress * 100),
                                            bestScore: p2GlobalBestScore,
                                            estimatedRemaining: Math.round(p2Remaining),
                                            bestCombination: phase2Best.bestCombination
                                        });
                                        
                                    } else if (type === 'complete') {
                                        phase2Results[wId] = wData;
                                        phase2WorkersCompleted++;
                                        
                                        if (wData.bestScore > phase2Best.bestScore) {
                                            phase2Best = wData;
                                            console.log(`🏆 2단계 새 최고점수: ${wData.bestScore}`);
                                        }
                                        
                                        console.log(`✅ 2단계 Worker ${wId + 1}/${numPhase2Workers} 완료 - 점수: ${wData.bestScore}`);
                                        
                                        // 모든 2단계 Worker 완료
                                        if (phase2WorkersCompleted >= numPhase2Workers) {
                                            let p2TotalProcessed = 0;
                                            let p2TotalSkipped = 0;
                                            
                                            phase2Results.forEach(function(result) {
                                                if (result) {
                                                    p2TotalProcessed += result.processed || 0;
                                                    p2TotalSkipped += result.skipped || 0;
                                                }
                                            });
                                            
                                            const totalElapsed = (Date.now() - parallelStartTime) / 1000;
                                            console.log(`🏁 2단계 완료! 총 소요시간: ${totalElapsed.toFixed(1)}초, 최종점수: ${phase2Best.bestScore}`);
                                            
                                            handleOptimizationComplete({
                                                bestScore: phase2Best.bestScore,
                                                bestCombination: phase2Best.bestCombination,
                                                processed: totalProcessed + p2TotalProcessed,
                                                skipped: totalSkipped + p2TotalSkipped,
                                                total: totalCombinations + phase2Total
                                            });
                                            
                                            // Worker 정리
                                            optimizationWorkers.forEach(function(w) { w.terminate(); });
                                            optimizationWorkers = [];
                                        }
                                    }
                                };
                                
                                worker.onerror = function(error) {
                                    console.error('2단계 Worker 오류:', error);
                                };
                                
                                optimizationWorkers.push(worker);
                                
                                worker.postMessage({
                                    type: 'startPartial',
                                    data: {
                                        weapons: workerWeapons,
                                        armors: phase2Armors,
                                        emblems: filteredEmblems,
                                        accessories: filteredAccessories,
                                        options: {
                                            role,
                                            classCode: selectedClass,
                                            stats
                                        },
                                        weaponStartIdx: 0,
                                        weaponEndIdx: workerWeapons.length,
                                        workerId: i,
                                        totalCombinations: phase2Total,
                                        initialBestScore: globalBest.bestScore  // 1단계 최고점수 전달
                                    }
                                });
                                
                                console.log(`[2단계 Worker ${i}] 무기 ${workerWeapons.length}개 할당`);
                            }
                        }
                        
                    } else if (type === 'error') {
                        console.error('Worker 내부 오류:', data.message, data.stack);
                    }
                };
                
                worker.onerror = function(error) {
                    console.error('Worker 오류:', error);
                };
                
                optimizationWorkers.push(worker);
                
                // Worker에 해당 무기 범위만 슬라이스해서 전송
                const workerWeapons = filteredWeapons.slice(weaponStartIdx, weaponEndIdx);
                
                worker.postMessage({
                    type: 'startPartial',
                    data: {
                        weapons: workerWeapons,
                        armors: filteredArmors,
                        emblems: filteredEmblems,
                        accessories: filteredAccessories,
                        options: {
                            role,
                            classCode: selectedClass,
                            stats
                        },
                        weaponStartIdx: 0,
                        weaponEndIdx: workerWeapons.length,
                        workerId: i,
                        totalCombinations
                    }
                });
                
                console.log(`[Worker ${i}] 무기 ${weaponStartIdx}~${weaponEndIdx-1} (${workerWeapons.length}개) 할당`);
            }
            
        } catch (error) {
            console.error('Worker 생성 실패:', error);
            showToast('Web Worker를 생성할 수 없습니다. 브라우저를 확인해주세요.', 'error');
            
            if (btnRecommend) {
                btnRecommend.disabled = false;
                btnRecommend.textContent = '🎯 최적 룬 조합 추천받기';
            }
        }
    }

    // ========================================
    // 기존 그리디 방식 (레거시 - 백업용)
    // @deprecated 2025-12-11 - Web Worker 방식으로 대체
    // ========================================
    function runRecommendationLegacy() {
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
            console.log('📦 카테고리 처리:', config.name, '(코드:', categoryCode + ')');

            // 해당 카테고리 룬 필터링
            // @updated 2025-12-10 - 새로운 등급 체계 기반 필터링
            var categoryRunes = state.allRunes.filter(function(rune) {
                // 카테고리 필터
                if (rune.category !== categoryCode) return false;

                // 효과 분석 불가 룬 제외
                // @added 2025-12-11 - effects 배열이 없거나 비어있는 룬 제외
                if (!rune.effects || !Array.isArray(rune.effects) || rune.effects.length === 0) {
                    return false;
                }

                // 등급 필터 (priority 기반)
                if (minGrade !== 'all') {
                    var gradeInfo = getGradeInfo(rune);
                    var minPriority = parseInt(minGrade) || 5;
                    if (!gradeInfo || gradeInfo.priority > minPriority) return false;
                }

                // 클래스 필터
                // @updated 2025-12-11 - classRestriction 필드 지원 추가 (수동 파싱 데이터 호환)
                if (selectedClass !== '00') {
                    var runeClass = rune.classRestriction || rune.klass || null;
                    // 클래스 제한이 없는 룬(null)은 모든 클래스에서 사용 가능
                    if (runeClass !== null && runeClass !== selectedClass && runeClass !== '00') {
                        return false;
                    }
                }

                return true;
            });

            console.log('  → 필터링 후 룬 수:', categoryRunes.length);

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

            console.log('  → 선택된 룬 수:', selectedRunes.length);

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
                                 src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                                 alt="${escapeHtml(rune.name)}"
                                 onerror="handleRuneImageError(this)">
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

        // 디버깅: 추천 결과 요약
        var totalRecommended = 0;
        Object.values(recommendations).forEach(function(data) {
            totalRecommended += data.runes.length;
        });
        console.log('✅ 추천 완료! 총 추천 룬 수:', totalRecommended);

        if (totalRecommended === 0) {
            showToast('조건에 맞는 룬이 없습니다. 필터 조건을 확인해주세요.', 'warning');
        } else {
            showToast('최적 룬 조합이 계산되었습니다! (' + totalRecommended + '개)', 'success');
        }
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
     */
    function resetStats() {
        const statInputs = $$('.stat-input__field');
        statInputs.forEach(input => {
            input.value = '';
        });

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
    // 11.5 캐릭터 프로필 관리 (Character Profile Management)
    // @added 2025-12-11
    // ============================================

    /**
     * 캐릭터 프로필 저장
     * @description 현재 입력된 스텟을 선택된 캐릭터에 저장
     * @updated 2025-12-11 - 전역 캐릭터 사용
     */
    function saveCurrentProfile() {
        if (!state.selectedCharacterId) {
            showToast('먼저 상단에서 캐릭터를 선택해주세요.', 'warning');
            return;
        }

        var profile = state.characterProfiles.find(function(p) {
            return p.id === state.selectedCharacterId;
        });

        if (!profile) {
            showToast('프로필을 찾을 수 없습니다.', 'error');
            return;
        }

        // 현재 스텟 수집
        profile.stats = collectCurrentStats();
        
        // 추천 옵션도 저장
        var roleEl = $('#recommend-role');
        var classEl = $('#recommend-class');
        var gradeEl = $('#recommend-min-grade');
        
        profile.options = {
            role: roleEl ? roleEl.value : 'dealer',
            classCode: classEl ? classEl.value : '00',
            minGrade: gradeEl ? gradeEl.value : '3'
        };

        profile.updatedAt = new Date().toISOString();

        saveCharacterProfiles();
        showToast('"' + profile.name + '" 프로필이 저장되었습니다.', 'success');
    }

    /**
     * 현재 입력된 스텟 수집
     * @returns {Object} 스텟 객체
     */
    function collectCurrentStats() {
        return {
            // 5대 기본 스텟
            str: parseInt($('#stat-str')?.value) || 0,
            dex: parseInt($('#stat-dex')?.value) || 0,
            int: parseInt($('#stat-int')?.value) || 0,
            wil: parseInt($('#stat-wil')?.value) || 0,
            luk: parseInt($('#stat-luk')?.value) || 0,
            // 주요 스텟
            atk: parseInt($('#stat-atk')?.value) || 0,
            def: parseInt($('#stat-def')?.value) || 0,
            // 세부 스텟
            break: parseInt($('#stat-break')?.value) || 0,
            smash: parseInt($('#stat-smash')?.value) || 0,
            combo: parseInt($('#stat-combo')?.value) || 0,
            skill: parseInt($('#stat-skill')?.value) || 0,
            aoe: parseInt($('#stat-aoe')?.value) || 0,
            heal: parseInt($('#stat-heal')?.value) || 0,
            evade: parseInt($('#stat-evade')?.value) || 0,
            extra: parseInt($('#stat-extra')?.value) || 0,
            dmgred: parseInt($('#stat-dmgred')?.value) || 0,
            atkspd: parseInt($('#stat-atkspd')?.value) || 0,
            chain: parseInt($('#stat-chain')?.value) || 0,
            skillspd: parseInt($('#stat-skillspd')?.value) || 0,
            hp: parseInt($('#stat-hp')?.value) || 0,
            ult: parseInt($('#stat-ult')?.value) || 0,
            crit: parseInt($('#stat-crit')?.value) || 0
        };
    }

    /**
     * 프로필 스텟을 입력 필드에 적용
     * @param {Object} profile - 프로필 데이터
     */
    function applyProfileToInputs(profile) {
        if (!profile) return;

        var stats = profile.stats || {};
        var options = profile.options || {};

        // 5대 기본 스텟
        setInputValue('#stat-str', stats.str);
        setInputValue('#stat-dex', stats.dex);
        setInputValue('#stat-int', stats.int);
        setInputValue('#stat-wil', stats.wil);
        setInputValue('#stat-luk', stats.luk);

        // 주요 스텟
        setInputValue('#stat-atk', stats.atk);
        setInputValue('#stat-def', stats.def);

        // 세부 스텟
        setInputValue('#stat-break', stats.break);
        setInputValue('#stat-smash', stats.smash);
        setInputValue('#stat-combo', stats.combo);
        setInputValue('#stat-skill', stats.skill);
        setInputValue('#stat-aoe', stats.aoe);
        setInputValue('#stat-heal', stats.heal);
        setInputValue('#stat-evade', stats.evade);
        setInputValue('#stat-extra', stats.extra);
        setInputValue('#stat-dmgred', stats.dmgred);
        setInputValue('#stat-atkspd', stats.atkspd);
        setInputValue('#stat-chain', stats.chain);
        setInputValue('#stat-skillspd', stats.skillspd);
        setInputValue('#stat-hp', stats.hp);
        setInputValue('#stat-ult', stats.ult);
        setInputValue('#stat-crit', stats.crit);

        // 추천 옵션 적용
        if (options.role) {
            var roleEl = $('#recommend-role');
            if (roleEl) roleEl.value = options.role;
        }
        if (options.classCode) {
            var classEl = $('#recommend-class');
            if (classEl) classEl.value = options.classCode;
        }
        if (options.minGrade) {
            var gradeEl = $('#recommend-min-grade');
            if (gradeEl) gradeEl.value = options.minGrade;
        }
    }

    /**
     * 입력 필드에 값 설정 헬퍼
     * @param {string} selector - CSS 선택자
     * @param {number} value - 설정할 값
     */
    function setInputValue(selector, value) {
        var el = $(selector);
        if (el) {
            el.value = value || '';
        }
    }

    /**
     * 프로필 선택 처리
     * @param {string} profileId - 프로필 ID
     */
    function selectProfile(profileId) {
        state.currentProfileId = profileId;

        if (!profileId) {
            // 선택 해제
            return;
        }

        var profile = state.characterProfiles.find(function(p) {
            return p.id === profileId;
        });

        if (profile) {
            applyProfileToInputs(profile);
            showToast('"' + profile.name + '" 프로필을 불러왔습니다.', 'success');
        }
    }

    /**
     * 새 캐릭터 등록 모달 열기
     * @updated 2025-12-11 - 디버그 로그 추가
     */
    function openNewProfileModal() {
        console.log('🔹 openNewProfileModal 호출됨');
        
        var modal = $('#profile-modal');
        console.log('🔹 profile-modal 요소:', modal);
        
        if (!modal) {
            console.error('❌ profile-modal 요소를 찾을 수 없습니다!');
            showToast('프로필 모달을 찾을 수 없습니다.', 'error');
            return;
        }

        // 입력 초기화
        var nameInput = $('#profile-name-input');
        var classSelect = $('#profile-class-select');
        var memoInput = $('#profile-memo-input');

        if (nameInput) nameInput.value = '';
        if (classSelect) classSelect.value = '';
        if (memoInput) memoInput.value = '';

        modal.classList.add('modal--open');
        console.log('✅ profile-modal 열림, classList:', modal.classList);
    }

    /**
     * 프로필 모달 닫기
     */
    function closeProfileModal() {
        var modal = $('#profile-modal');
        if (modal) {
            modal.classList.remove('modal--open');
        }
    }

    /**
     * 새 캐릭터 프로필 생성
     */
    function createNewProfile() {
        var nameInput = $('#profile-name-input');
        var classSelect = $('#profile-class-select');
        var memoInput = $('#profile-memo-input');

        var name = nameInput ? nameInput.value.trim() : '';
        var classCode = classSelect ? classSelect.value : '';
        var memo = memoInput ? memoInput.value.trim() : '';

        // 유효성 검사
        if (!name) {
            showToast('캐릭터 이름을 입력해주세요.', 'error');
            return;
        }

        if (!classCode) {
            showToast('클래스를 선택해주세요.', 'error');
            return;
        }

        // 중복 이름 검사
        var isDuplicate = state.characterProfiles.some(function(p) {
            return p.name === name;
        });

        if (isDuplicate) {
            showToast('이미 같은 이름의 캐릭터가 있습니다.', 'error');
            return;
        }

        // 새 프로필 생성
        var newProfile = {
            id: 'profile_' + Date.now(),
            name: name,
            classCode: classCode,
            className: CLASS_MAP[classCode] || '알 수 없음',
            memo: memo,
            stats: {},
            options: {
                role: 'dealer',
                classCode: classCode,
                minGrade: '3'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        state.characterProfiles.push(newProfile);
        saveCharacterProfiles();

        // 전역 캐릭터로 선택 @updated 2025-12-11
        selectGlobalCharacter(newProfile.id);
        renderProfileList();

        closeProfileModal();
        showToast('"' + name + '" 캐릭터가 등록되었습니다!', 'success');
    }

    /**
     * 프로필 ID로 선택
     * @param {string} profileId - 프로필 ID
     */
    function selectProfileById(profileId) {
        var selectEl = $('#profile-select');
        if (selectEl) {
            selectEl.value = profileId;
        }
        selectProfile(profileId);
    }

    /**
     * 프로필 삭제 (기존 호환)
     * @updated 2025-12-11 - 전역 캐릭터 사용
     */
    function deleteCurrentProfile() {
        if (!state.selectedCharacterId) {
            showToast('삭제할 캐릭터를 상단에서 선택해주세요.', 'warning');
            return;
        }
        confirmDeleteCharacter(state.selectedCharacterId);
    }

    /**
     * 캐릭터 삭제 컨펌 모달 표시
     * @param {string} charId - 삭제할 캐릭터 ID
     * @added 2025-12-12
     */
    function confirmDeleteCharacter(charId) {
        var profile = state.characterProfiles.find(function(p) {
            return p.id === charId;
        });

        if (!profile) {
            showToast('프로필을 찾을 수 없습니다.', 'error');
            return;
        }

        // 컨펌 모달 표시
        var modal = $('#confirm-delete-modal');
        var charNameEl = $('#confirm-delete-char-name');
        var confirmBtn = $('#btn-confirm-delete');
        
        if (!modal) {
            // 모달이 없으면 기본 confirm 사용
            if (confirm('"' + profile.name + '" 캐릭터를 삭제하시겠습니까?\n\n저장된 스텟, 보유 룬, 장착 정보가 모두 삭제됩니다.')) {
                executeDeleteCharacter(charId);
            }
            return;
        }
        
        // 모달에 캐릭터 정보 표시
        if (charNameEl) {
            charNameEl.textContent = profile.name;
        }
        
        // 삭제 대상 ID 저장
        state.pendingDeleteCharId = charId;
        
        // 모달 열기
        modal.classList.add('modal--open');
    }

    /**
     * 캐릭터 삭제 실행
     * @param {string} charId - 삭제할 캐릭터 ID
     * @added 2025-12-12
     */
    function executeDeleteCharacter(charId) {
        var profile = state.characterProfiles.find(function(p) {
            return p.id === charId;
        });

        if (!profile) {
            showToast('프로필을 찾을 수 없습니다.', 'error');
            return;
        }

        var profileName = profile.name;

        // 삭제
        state.characterProfiles = state.characterProfiles.filter(function(p) {
            return p.id !== charId;
        });

        // 장착 룬 및 보유 룬 데이터도 삭제
        delete state.characterEquipments[charId];
        delete state.characterOwnedRunes[charId];

        // 현재 선택된 캐릭터였다면 선택 해제
        if (state.selectedCharacterId === charId) {
            state.selectedCharacterId = null;
            saveToStorage('selectedCharacterId', null);
            resetStats();
        }

        saveCharacterProfiles();
        saveCharacterEquipments();
        saveCharacterOwnedRunes();
        
        // 전역 캐릭터 UI 업데이트
        updateGlobalCharacterDisplay();
        renderProfileList();
        
        // 드롭다운 닫기
        closeGlobalCharDropdown();

        showToast('"' + profileName + '" 캐릭터가 삭제되었습니다.', 'success');
    }

    /**
     * 삭제 컨펌 모달 닫기
     * @added 2025-12-12
     */
    function closeConfirmDeleteModal() {
        var modal = $('#confirm-delete-modal');
        if (modal) {
            modal.classList.remove('modal--open');
        }
        state.pendingDeleteCharId = null;
    }

    /**
     * 프로필 목록 렌더링
     */
    function renderProfileList() {
        var selectEl = $('#profile-select');
        if (!selectEl) return;

        // 기본 옵션
        var html = '<option value="">-- 프로필 선택 --</option>';

        // 프로필 목록
        state.characterProfiles.forEach(function(profile) {
            var className = CLASS_MAP[profile.classCode] || profile.className || '';
            var displayName = profile.name;
            if (className) {
                displayName += ' (' + className.split(' ')[0] + ')';
            }
            if (profile.memo) {
                displayName += ' - ' + profile.memo;
            }

            var selected = profile.id === state.currentProfileId ? 'selected' : '';
            html += '<option value="' + profile.id + '" ' + selected + '>' + escapeHtml(displayName) + '</option>';
        });

        selectEl.innerHTML = html;
    }

    /**
     * 캐릭터 프로필 저장 (LocalStorage)
     */
    function saveCharacterProfiles() {
        saveToStorage(STORAGE_KEYS.CHARACTER_PROFILES, state.characterProfiles);
    }

    /**
     * 캐릭터 프로필 불러오기 (LocalStorage)
     */
    function loadCharacterProfiles() {
        state.characterProfiles = loadFromStorage(STORAGE_KEYS.CHARACTER_PROFILES, []);
        // 마지막 선택된 캐릭터 복원
        state.selectedCharacterId = loadFromStorage('selectedCharacterId', null);
        renderProfileList();
        updateGlobalCharacterDisplay();
    }

    // ============================================
    // 11-1. 전역 캐릭터 관리 @added 2025-12-11
    // ============================================

    /**
     * 전역 캐릭터 선택
     * @param {string|null} charId - 캐릭터 ID
     */
    function selectGlobalCharacter(charId) {
        state.selectedCharacterId = charId;
        saveToStorage('selectedCharacterId', charId);
        
        // UI 업데이트
        updateGlobalCharacterDisplay();
        closeGlobalCharDropdown();
        
        // 캐릭터 선택 시 관련 기능 갱신
        if (charId) {
            const profile = state.characterProfiles.find(p => p.id === charId);
            if (profile) {
                // 추천 시스템 탭: 스텟 폼 업데이트
                applyProfileToStatForm(profile);
                showToast(`${profile.name} 캐릭터가 선택되었습니다.`, 'success');
            }
        }
        
        // 현재 활성 탭에 따라 UI 갱신
        refreshCurrentTabForCharacter();
    }

    /**
     * 전역 캐릭터 표시 업데이트
     */
    function updateGlobalCharacterDisplay() {
        const nameEl = $('#global-char-name');
        const iconEl = $('.global-character-select__icon');
        
        if (!nameEl) return;
        
        if (state.selectedCharacterId) {
            const profile = state.characterProfiles.find(p => p.id === state.selectedCharacterId);
            if (profile) {
                nameEl.textContent = profile.name;
                if (iconEl) {
                    iconEl.textContent = getClassIcon(profile.className);
                }
                return;
            }
        }
        
        nameEl.textContent = '캐릭터 선택';
        if (iconEl) iconEl.textContent = '👤';
    }

    /**
     * 클래스별 아이콘 반환
     * @param {string} className - 클래스명
     * @returns {string} 아이콘
     */
    function getClassIcon(className) {
        const icons = {
            '워리어': '⚔️',
            '레인저': '🏹',
            '메이지': '🔮',
            '힐러': '💚',
            '어쌔신': '🗡️'
        };
        return icons[className] || '👤';
    }

    /**
     * 전역 캐릭터 드롭다운 열기/닫기 토글
     */
    function toggleGlobalCharDropdown() {
        const dropdown = $('#global-char-dropdown');
        if (!dropdown) return;
        
        if (dropdown.style.display === 'none') {
            openGlobalCharDropdown();
        } else {
            closeGlobalCharDropdown();
        }
    }

    /**
     * 전역 캐릭터 드롭다운 열기
     */
    function openGlobalCharDropdown() {
        const dropdown = $('#global-char-dropdown');
        const list = $('#global-char-list');
        
        if (!dropdown || !list) return;
        
        // 캐릭터 목록 생성
        list.innerHTML = state.characterProfiles.length === 0
            ? '<div class="global-char-item" style="color:#888;cursor:default;">등록된 캐릭터가 없습니다</div>'
            : state.characterProfiles.map(profile => {
                const isActive = profile.id === state.selectedCharacterId;
                const ownedCount = (state.characterOwnedRunes[profile.id] || []).length;
                const equippedCount = getEquippedCount(profile.id);
                
                // @updated 2025-12-12 삭제 버튼 추가
                return `
                    <div class="global-char-item ${isActive ? 'global-char-item--active' : ''}" 
                         data-char-id="${profile.id}">
                        <div class="global-char-item__icon">${getClassIcon(profile.className)}</div>
                        <div class="global-char-item__info">
                            <div class="global-char-item__name">${escapeHtml(profile.name)}</div>
                            <div class="global-char-item__class">${profile.className}</div>
                        </div>
                        <div class="global-char-item__stats">
                            💎${ownedCount} / 🎯${equippedCount}
                        </div>
                        <button class="global-char-item__delete" data-delete-id="${profile.id}" title="캐릭터 삭제">
                            🗑️
                        </button>
                    </div>
                `;
            }).join('');
        
        dropdown.style.display = 'block';
        
        // 외부 클릭 시 닫기
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
    }

    /**
     * 장착된 룬 개수 반환
     * @param {string} charId - 캐릭터 ID
     * @returns {number}
     */
    function getEquippedCount(charId) {
        const equipment = state.characterEquipments[charId];
        if (!equipment) return 0;
        
        let count = 0;
        if (equipment.weapon) count++;
        if (equipment.emblem) count++;
        equipment.armors.forEach(a => { if (a) count++; });
        equipment.accessories.forEach(a => { if (a) count++; });
        return count;
    }

    /**
     * 전역 캐릭터 드롭다운 닫기
     */
    function closeGlobalCharDropdown() {
        const dropdown = $('#global-char-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        document.removeEventListener('click', handleOutsideClick);
    }

    /**
     * 드롭다운 외부 클릭 핸들러
     */
    function handleOutsideClick(e) {
        const area = $('#global-character-area');
        if (area && !area.contains(e.target)) {
            closeGlobalCharDropdown();
        }
    }

    /**
     * 현재 탭에 맞게 UI 갱신
     */
    function refreshCurrentTabForCharacter() {
        const activeTab = $('.tab-nav__btn--active');
        if (!activeTab) return;
        
        const tabId = activeTab.dataset.tab;
        
        switch (tabId) {
            case 'rune-list':
                renderRuneList();
                break;
            case 'recommend':
                renderProfileList();
                break;
            case 'equipment':
                renderEquipmentSlots(state.selectedCharacterId);
                break;
        }
    }

    /**
     * 프로필을 스텟 폼에 적용
     * @param {Object} profile - 캐릭터 프로필
     */
    function applyProfileToStatForm(profile) {
        if (!profile || !profile.stats) return;
        
        // 클래스 선택
        const classSelect = $('#stat-class');
        if (classSelect && profile.className) {
            const classCode = Object.entries(CLASS_MAP).find(([k, v]) => v === profile.className);
            if (classCode) classSelect.value = classCode[0];
        }
        
        // 스텟 입력 폼 업데이트
        Object.entries(profile.stats).forEach(([key, value]) => {
            const input = $(`#stat-${key}`);
            if (input) input.value = value;
        });
    }

    // ============================================
    // 12. 즐겨찾기 (Favorites)
    // ============================================

    /**
     * 즐겨찾기/보유 룬 토글
     * @param {number} runeId - 룬 ID
     * @updated 2025-12-11 - 전역 캐릭터별 보유 룬 기능
     */
    function toggleFavorite(runeId) {
        const charId = state.selectedCharacterId;
        const rune = state.allRunes.find(r => r.id === runeId);
        const runeName = rune ? rune.name : '룬';

        // 캐릭터가 선택되어 있으면 보유 룬으로 처리
        if (charId) {
            const profile = state.characterProfiles.find(p => p.id === charId);
            const charName = profile ? profile.name : '캐릭터';

            if (isRuneOwned(charId, runeId)) {
                removeOwnedRune(charId, runeId);
                showToast(`${charName}의 보유 룬에서 "${runeName}" 제거됨`, 'info');
            } else {
                addOwnedRune(charId, runeId);
                showToast(`${charName}의 보유 룬에 "${runeName}" 추가됨`, 'success');
            }
            
            updateGlobalCharacterDisplay(); // 보유 개수 업데이트 @fixed 2025-12-12
            renderRuneList(); // 목록 업데이트 (아이콘 상태)
            return;
        }

        // 캐릭터 미선택 시 기존 즐겨찾기로 동작
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
    // 12-2. 캐릭터별 장착 룬 관리
    // @added 2025-12-11
    // ============================================

    /**
     * 캐릭터 장착 룬 저장
     */
    function saveCharacterEquipments() {
        saveToStorage(STORAGE_KEYS.CHARACTER_EQUIPMENTS, state.characterEquipments);
    }

    /**
     * 캐릭터 장착 룬 불러오기
     */
    function loadCharacterEquipments() {
        state.characterEquipments = loadFromStorage(STORAGE_KEYS.CHARACTER_EQUIPMENTS, {});
    }

    /**
     * 캐릭터 보유 룬 저장
     * @added 2025-12-11
     */
    function saveCharacterOwnedRunes() {
        saveToStorage(STORAGE_KEYS.CHARACTER_OWNED_RUNES, state.characterOwnedRunes);
    }

    /**
     * 캐릭터 보유 룬 불러오기
     * @added 2025-12-11
     */
    function loadCharacterOwnedRunes() {
        state.characterOwnedRunes = loadFromStorage(STORAGE_KEYS.CHARACTER_OWNED_RUNES, {});
    }

    /**
     * 캐릭터에 보유 룬 추가
     * @param {string} charId - 캐릭터 프로필 ID
     * @param {number} runeId - 룬 ID
     * @added 2025-12-11
     */
    function addOwnedRune(charId, runeId) {
        if (!charId) return false;
        
        if (!state.characterOwnedRunes[charId]) {
            state.characterOwnedRunes[charId] = [];
        }
        
        // 이미 보유 중이면 추가하지 않음
        if (state.characterOwnedRunes[charId].includes(runeId)) {
            return false;
        }
        
        state.characterOwnedRunes[charId].push(runeId);
        saveCharacterOwnedRunes();
        return true;
    }

    /**
     * 캐릭터에서 보유 룬 제거
     * @param {string} charId - 캐릭터 프로필 ID
     * @param {number} runeId - 룬 ID
     * @added 2025-12-11
     */
    function removeOwnedRune(charId, runeId) {
        if (!charId || !state.characterOwnedRunes[charId]) return false;
        
        const idx = state.characterOwnedRunes[charId].indexOf(runeId);
        if (idx === -1) return false;
        
        state.characterOwnedRunes[charId].splice(idx, 1);
        saveCharacterOwnedRunes();
        return true;
    }

    /**
     * 캐릭터가 해당 룬을 보유 중인지 확인
     * @param {string} charId - 캐릭터 프로필 ID
     * @param {number} runeId - 룬 ID
     * @returns {boolean}
     * @added 2025-12-11
     */
    function isRuneOwned(charId, runeId) {
        if (!charId || !state.characterOwnedRunes[charId]) return false;
        return state.characterOwnedRunes[charId].includes(runeId);
    }

    /**
     * 캐릭터의 보유 룬 목록 가져오기
     * @param {string} charId - 캐릭터 프로필 ID
     * @returns {Array} 보유 룬 객체 배열
     * @added 2025-12-11
     */
    function getOwnedRunes(charId) {
        if (!charId || !state.characterOwnedRunes[charId]) return [];
        return state.characterOwnedRunes[charId]
            .map(id => state.allRunes.find(r => r.id === id))
            .filter(r => r);
    }

    // @deprecated 2025-12-11 - 전역 캐릭터 선택으로 통합됨
    // 이 함수들은 더 이상 필요하지 않음

    /**
     * 장착 탭 캐릭터 선택 드롭다운 업데이트 (레거시)
     * @deprecated 2025-12-11 - 전역 캐릭터 선택 사용
     */
    function updateEquipmentCharacterSelect() {
        // 전역 캐릭터 선택으로 대체됨
        return;

        select.innerHTML = '<option value="">-- 캐릭터를 선택하세요 --</option>';
        
        state.characterProfiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name + ' (' + profile.className + ')';
            if (profile.id === state.selectedCharacterId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    /**
     * 보유룬 탭 UI 업데이트 (전역 캐릭터 기반)
     * @updated 2025-12-11 - 보유 룬 목록 중심 UI로 재구성
     */
    function updateEquipmentTabUI() {
        const charId = state.selectedCharacterId;
        
        const mainEl = $('#owned-main');
        const emptyEl = $('#owned-empty');

        if (!charId) {
            // 캐릭터 미선택
            if (mainEl) mainEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'flex';
            return;
        }

        // 캐릭터 선택됨
        if (mainEl) mainEl.style.display = 'block';
        if (emptyEl) emptyEl.style.display = 'none';

        // 보유 룬 목록 렌더링
        renderOwnedRunesTab(charId);
    }

    /**
     * 보유룬 탭 전체 렌더링
     * @param {string} charId - 캐릭터 프로필 ID
     * @added 2025-12-11
     */
    function renderOwnedRunesTab(charId) {
        const ownedRunes = getOwnedRunes(charId);
        const equipment = state.characterEquipments[charId] || {
            weapon: null,
            armors: [null, null, null, null, null],
            emblem: null,
            accessories: [null, null, null]
        };

        // 장착된 룬 ID 목록
        const equippedIds = new Set();
        if (equipment.weapon) equippedIds.add(equipment.weapon);
        if (equipment.emblem) equippedIds.add(equipment.emblem);
        equipment.armors.forEach(id => { if (id) equippedIds.add(id); });
        equipment.accessories.forEach(id => { if (id) equippedIds.add(id); });

        // 장착된 룬 점수 합산
        let totalScore = 0;
        equippedIds.forEach(id => {
            const rune = state.allRunes.find(r => r.id === id);
            if (rune) totalScore += rune.baseScore || 0;
        });

        // 장착 미니바 렌더링
        renderEquippedMinibar(equippedIds, totalScore);

        // 보유 룬 목록 렌더링 (카테고리별)
        renderOwnedRunesList(ownedRunes, equippedIds);
    }

    /**
     * 장착 미니바 렌더링
     * @param {Set} equippedIds - 장착된 룬 ID Set
     * @param {number} totalScore - 총 효율 점수
     */
    function renderEquippedMinibar(equippedIds, totalScore) {
        const countEl = $('#equipped-count');
        const scoreEl = $('#equipped-score');
        const slotsEl = $('#equipped-minibar-slots');

        if (countEl) countEl.textContent = equippedIds.size;
        if (scoreEl) scoreEl.textContent = totalScore.toFixed(1);

        if (slotsEl) {
            if (equippedIds.size === 0) {
                slotsEl.innerHTML = '<span style="color:#888;font-size:12px;">장착된 룬이 없습니다</span>';
            } else {
                const items = [];
                equippedIds.forEach(id => {
                    const rune = state.allRunes.find(r => r.id === id);
                    if (rune) {
                        items.push(`
                            <div class="equipped-mini-item" data-rune-id="${rune.id}" title="클릭하여 해제">
                                <img class="equipped-mini-item__img" 
                                     src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                                     alt="${escapeHtml(rune.name)}"
                                     onerror="handleRuneImageError(this)">
                                <span class="equipped-mini-item__name">${escapeHtml(rune.name)}</span>
                                <span class="equipped-mini-item__remove">×</span>
                            </div>
                        `);
                    }
                });
                slotsEl.innerHTML = items.join('');
            }
        }
    }

    /**
     * 보유 룬 목록 렌더링 (카테고리별)
     * @param {Array} ownedRunes - 보유 룬 배열
     * @param {Set} equippedIds - 장착된 룬 ID Set
     */
    function renderOwnedRunesList(ownedRunes, equippedIds) {
        const totalCountEl = $('#owned-total-count');
        const emptyHintEl = $('#owned-empty-hint');
        
        if (totalCountEl) totalCountEl.textContent = ownedRunes.length;

        // 카테고리별 분류
        const categoryOrder = ['01', '04', '02', '03'];
        const byCategory = { '01': [], '04': [], '02': [], '03': [] };
        
        ownedRunes.forEach(rune => {
            if (byCategory[rune.category]) {
                byCategory[rune.category].push(rune);
            }
        });

        // 각 카테고리 렌더링
        categoryOrder.forEach(cat => {
            const catEl = $(`#owned-category-${cat}`);
            if (!catEl) return;

            const runes = byCategory[cat];
            const countEl = catEl.querySelector('.owned-cat-count');
            const gridEl = catEl.querySelector('.owned-category__grid');

            if (countEl) countEl.textContent = runes.length;

            if (gridEl) {
                if (runes.length === 0) {
                    gridEl.innerHTML = '<span style="color:#666;font-size:12px;padding:8px;">보유 룬 없음</span>';
                } else {
                    gridEl.innerHTML = runes.map(rune => {
                        const isEquipped = equippedIds.has(rune.id);
                        return `
                            <div class="owned-rune-item ${isEquipped ? 'owned-rune-item--equipped' : ''}" 
                                 data-rune-id="${rune.id}" 
                                 data-category="${rune.category}">
                                <img class="owned-rune-item__img" 
                                     src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                                     alt="${escapeHtml(rune.name)}"
                                     onerror="handleRuneImageError(this)">
                                <div class="owned-rune-item__name">${escapeHtml(rune.name)}</div>
                                <div class="owned-rune-item__score">${(rune.baseScore || 0).toFixed(1)}점</div>
                                <div class="owned-rune-item__actions">
                                    ${isEquipped 
                                        ? '<button class="owned-rune-item__btn owned-rune-item__btn--remove" data-action="unequip">해제</button>'
                                        : '<button class="owned-rune-item__btn owned-rune-item__btn--equip" data-action="equip">장착</button>'
                                    }
                                    <button class="owned-rune-item__btn" data-action="remove" style="background:#666;">삭제</button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        });

        // 빈 안내 표시
        if (emptyHintEl) {
            emptyHintEl.style.display = ownedRunes.length === 0 ? 'block' : 'none';
        }
    }

    /**
     * 장착 슬롯 렌더링
     * @param {string} charId - 캐릭터 프로필 ID
     */
    function renderEquipmentSlots(charId) {
        const equipment = state.characterEquipments[charId] || {
            weapon: null,
            armors: [null, null, null, null, null],
            emblem: null,
            accessories: [null, null, null]
        };

        // 장착 현황 계산
        let equippedCount = 0;
        let totalScore = 0;

        // 무기 슬롯
        const weaponSlot = $('[data-slot="equip-weapon-1"]');
        if (weaponSlot) {
            if (equipment.weapon) {
                const rune = state.allRunes.find(r => r.id === equipment.weapon);
                if (rune) {
                    renderEquipmentSlotContent(weaponSlot, rune);
                    equippedCount++;
                    totalScore += rune.baseScore || 0;
                }
            } else {
                renderEquipmentSlotEmpty(weaponSlot);
            }
        }

        // 방어구 슬롯 (5개)
        for (let i = 0; i < 5; i++) {
            const slot = $('[data-slot="equip-armor-' + (i + 1) + '"]');
            if (slot) {
                const runeId = equipment.armors[i];
                if (runeId) {
                    const rune = state.allRunes.find(r => r.id === runeId);
                    if (rune) {
                        renderEquipmentSlotContent(slot, rune);
                        equippedCount++;
                        totalScore += rune.baseScore || 0;
                    }
                } else {
                    renderEquipmentSlotEmpty(slot);
                }
            }
        }

        // 엠블럼 슬롯
        const emblemSlot = $('[data-slot="equip-emblem-1"]');
        if (emblemSlot) {
            if (equipment.emblem) {
                const rune = state.allRunes.find(r => r.id === equipment.emblem);
                if (rune) {
                    renderEquipmentSlotContent(emblemSlot, rune);
                    equippedCount++;
                    totalScore += rune.baseScore || 0;
                }
            } else {
                renderEquipmentSlotEmpty(emblemSlot);
            }
        }

        // 장신구 슬롯 (3개)
        for (let i = 0; i < 3; i++) {
            const slot = $('[data-slot="equip-accessory-' + (i + 1) + '"]');
            if (slot) {
                const runeId = equipment.accessories[i];
                if (runeId) {
                    const rune = state.allRunes.find(r => r.id === runeId);
                    if (rune) {
                        renderEquipmentSlotContent(slot, rune);
                        equippedCount++;
                        totalScore += rune.baseScore || 0;
                    }
                } else {
                    renderEquipmentSlotEmpty(slot);
                }
            }
        }

        // 요약 정보 업데이트
        const countEl = $('#equipment-count');
        const emptyCountEl = $('#equipment-empty-count');
        const scoreEl = $('#equipment-total-score');

        if (countEl) countEl.textContent = equippedCount;
        if (emptyCountEl) emptyCountEl.textContent = 10 - equippedCount;
        if (scoreEl) scoreEl.textContent = '총 효율: ' + totalScore.toFixed(1) + '점';

        // 보유 룬 목록 렌더링 @added 2025-12-11
        // @fixed 2025-12-12 - 함수명 충돌 해결
        renderEquipmentOwnedRunes(charId, equipment);
    }

    /**
     * 장착 탭용 보유 룬 목록 렌더링 (레거시)
     * @param {string} charId - 캐릭터 프로필 ID
     * @param {Object} equipment - 현재 장착 정보
     * @added 2025-12-11
     * @renamed 2025-12-12 - renderOwnedRunesList → renderEquipmentOwnedRunes (함수명 충돌 해결)
     */
    function renderEquipmentOwnedRunes(charId, equipment) {
        const ownedSection = $('#equipment-owned');
        const ownedGrid = $('#owned-runes-grid');
        const ownedCountEl = $('#owned-rune-count');

        if (!ownedSection || !ownedGrid) return;

        const ownedRunes = getOwnedRunes(charId);
        
        // 보유 룬이 없으면 숨김
        if (ownedRunes.length === 0) {
            ownedSection.style.display = 'none';
            return;
        }

        ownedSection.style.display = 'block';
        if (ownedCountEl) ownedCountEl.textContent = ownedRunes.length;

        // 장착된 룬 ID 목록
        const equippedIds = new Set();
        if (equipment.weapon) equippedIds.add(equipment.weapon);
        equipment.armors.forEach(id => { if (id) equippedIds.add(id); });
        if (equipment.emblem) equippedIds.add(equipment.emblem);
        equipment.accessories.forEach(id => { if (id) equippedIds.add(id); });

        // 카테고리별 정렬 (순서: 무기-엠블럼-방어구-장신구) @updated 2025-12-11
        const sortedRunes = [...ownedRunes].sort((a, b) => {
            const catOrder = { '01': 1, '04': 2, '02': 3, '03': 4 };
            return (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
        });

        ownedGrid.innerHTML = sortedRunes.map(rune => {
            const isEquipped = equippedIds.has(rune.id);
            const categoryName = CATEGORY_MAP[rune.category] || '기타';
            
            return `
                <div class="owned-rune-card ${isEquipped ? 'owned-rune-card--equipped' : ''}" 
                     data-rune-id="${rune.id}" 
                     data-category="${rune.category}"
                     title="${isEquipped ? '장착됨' : '클릭하여 장착'}">
                    <img class="owned-rune-card__image" 
                         src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                         alt="${escapeHtml(rune.name)}"
                         onerror="handleRuneImageError(this)">
                    <div class="owned-rune-card__name">${escapeHtml(rune.name)}</div>
                    <div class="owned-rune-card__category">${categoryName}</div>
                    ${isEquipped ? '<span style="color:#4CAF50;font-size:10px;">✓ 장착됨</span>' : ''}
                </div>
            `;
        }).join('');

        // 보유 룬 카드 클릭 이벤트
        ownedGrid.querySelectorAll('.owned-rune-card').forEach(card => {
            card.addEventListener('click', function() {
                const runeId = parseInt(this.dataset.runeId);
                const category = this.dataset.category;
                
                // 해당 카테고리의 빈 슬롯 찾기
                const slotPrefix = category === '01' ? 'equip-weapon-' :
                    category === '02' ? 'equip-armor-' :
                    category === '04' ? 'equip-emblem-' : 'equip-accessory-';
                
                const maxSlots = category === '02' ? 5 : category === '03' ? 3 : 1;
                
                for (let i = 1; i <= maxSlots; i++) {
                    const slotId = slotPrefix + i;
                    const slot = $('[data-slot="' + slotId + '"]');
                    if (slot && !slot.classList.contains('equipment-slot--filled')) {
                        equipRuneToEquipmentSlot(slotId, runeId);
                        showToast('룬이 장착되었습니다.', 'success');
                        return;
                    }
                }
                
                // 빈 슬롯이 없으면 첫 번째 슬롯에 교체
                const slotId = slotPrefix + '1';
                equipRuneToEquipmentSlot(slotId, runeId);
                showToast('룬이 교체되었습니다.', 'info');
            });
        });
    }

    /**
     * 장착 슬롯에 룬 표시
     * @param {HTMLElement} slot - 슬롯 요소
     * @param {Object} rune - 룬 데이터
     */
    function renderEquipmentSlotContent(slot, rune) {
        slot.classList.add('equipment-slot--filled');
        slot.innerHTML = `
            <div class="equipment-slot__rune" data-rune-id="${rune.id}">
                <img class="equipment-slot__image" 
                     src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                     alt="${escapeHtml(rune.name)}"
                     onerror="handleRuneImageError(this)">
                <div class="equipment-slot__name">${escapeHtml(rune.name)}</div>
                <div class="equipment-slot__score">${(rune.baseScore || 0).toFixed(1)}점</div>
            </div>
            <button class="equipment-slot__remove" title="장착 해제">×</button>
        `;
    }

    /**
     * 장착 슬롯 비우기
     * @param {HTMLElement} slot - 슬롯 요소
     */
    function renderEquipmentSlotEmpty(slot) {
        slot.classList.remove('equipment-slot--filled');
        slot.innerHTML = '<div class="equipment-slot__empty">클릭하여 장착</div>';
    }

    /**
     * 장착 슬롯에 룬 장착
     * @param {string} slotId - 슬롯 ID
     * @param {number} runeId - 룬 ID
     */
    function equipRuneToEquipmentSlot(slotId, runeId) {
        const charId = state.selectedEquipmentCharId;
        if (!charId) return;

        // 장착 데이터 초기화
        if (!state.characterEquipments[charId]) {
            state.characterEquipments[charId] = {
                weapon: null,
                armors: [null, null, null, null, null],
                emblem: null,
                accessories: [null, null, null]
            };
        }

        const equipment = state.characterEquipments[charId];

        // 슬롯 타입에 따라 장착
        if (slotId === 'equip-weapon-1') {
            equipment.weapon = runeId;
        } else if (slotId.startsWith('equip-armor-')) {
            const idx = parseInt(slotId.replace('equip-armor-', '')) - 1;
            equipment.armors[idx] = runeId;
        } else if (slotId === 'equip-emblem-1') {
            equipment.emblem = runeId;
        } else if (slotId.startsWith('equip-accessory-')) {
            const idx = parseInt(slotId.replace('equip-accessory-', '')) - 1;
            equipment.accessories[idx] = runeId;
        }

        // 저장 및 렌더링
        saveCharacterEquipments();
        renderEquipmentSlots(charId);
    }

    /**
     * 장착 슬롯에서 룬 해제
     * @param {string} slotId - 슬롯 ID
     */
    function unequipFromEquipmentSlot(slotId) {
        equipRuneToEquipmentSlot(slotId, null);
    }

    /**
     * 보유 룬에서 장착
     * @param {number} runeId - 룬 ID
     * @param {string} category - 카테고리 코드
     * @added 2025-12-11
     */
    function equipRuneFromOwned(runeId, category) {
        const charId = state.selectedCharacterId;
        if (!charId) return;

        if (!state.characterEquipments[charId]) {
            state.characterEquipments[charId] = {
                weapon: null,
                armors: [null, null, null, null, null],
                emblem: null,
                accessories: [null, null, null]
            };
        }

        const equipment = state.characterEquipments[charId];

        // 카테고리에 맞는 빈 슬롯 찾아서 장착
        if (category === '01') {
            equipment.weapon = runeId;
        } else if (category === '04') {
            equipment.emblem = runeId;
        } else if (category === '02') {
            // 방어구 빈 슬롯 찾기
            const idx = equipment.armors.findIndex(a => a === null);
            if (idx !== -1) {
                equipment.armors[idx] = runeId;
            } else {
                equipment.armors[0] = runeId; // 없으면 첫 번째 교체
            }
        } else if (category === '03') {
            // 장신구 빈 슬롯 찾기
            const idx = equipment.accessories.findIndex(a => a === null);
            if (idx !== -1) {
                equipment.accessories[idx] = runeId;
            } else {
                equipment.accessories[0] = runeId; // 없으면 첫 번째 교체
            }
        }

        saveCharacterEquipments();
        updateEquipmentTabUI();
        showToast('장착되었습니다.', 'success');
    }

    /**
     * 룬 ID로 장착 해제
     * @param {number} runeId - 룬 ID
     * @added 2025-12-11
     */
    function unequipRuneById(runeId) {
        const charId = state.selectedCharacterId;
        if (!charId) return;

        const equipment = state.characterEquipments[charId];
        if (!equipment) return;

        // 각 슬롯에서 해당 룬 찾아서 해제
        if (equipment.weapon === runeId) {
            equipment.weapon = null;
        }
        if (equipment.emblem === runeId) {
            equipment.emblem = null;
        }
        for (let i = 0; i < equipment.armors.length; i++) {
            if (equipment.armors[i] === runeId) {
                equipment.armors[i] = null;
            }
        }
        for (let i = 0; i < equipment.accessories.length; i++) {
            if (equipment.accessories[i] === runeId) {
                equipment.accessories[i] = null;
            }
        }

        saveCharacterEquipments();
        updateEquipmentTabUI();
        showToast('장착 해제되었습니다.', 'info');
    }

    /**
     * 전체 장착 해제
     * @updated 2025-12-11
     */
    function clearAllEquipment() {
        const charId = state.selectedCharacterId;
        if (!charId) return;

        state.characterEquipments[charId] = {
            weapon: null,
            armors: [null, null, null, null, null],
            emblem: null,
            accessories: [null, null, null]
        };

        saveCharacterEquipments();
        updateEquipmentTabUI();
        showToast('장착이 모두 해제되었습니다.', 'info');
    }

    /**
     * 빈 슬롯 최적화 (기존 장착 유지, 보유 룬 내에서 선택)
     * @updated 2025-12-11 - 전역 캐릭터 기반
     */
    function optimizeEmptySlots() {
        const charId = state.selectedCharacterId;
        if (!charId) {
            showToast('캐릭터를 먼저 선택해주세요.', 'error');
            return;
        }

        const profile = state.characterProfiles.find(p => p.id === charId);
        if (!profile) {
            showToast('캐릭터 정보를 찾을 수 없습니다.', 'error');
            return;
        }

        // @fixed 2025-12-12 - 안전한 기본값 초기화
        const savedEquip = state.characterEquipments[charId] || {};
        const equipment = {
            weapon: savedEquip.weapon || null,
            armors: Array.isArray(savedEquip.armors) && savedEquip.armors.length === 5 
                ? [...savedEquip.armors] 
                : [null, null, null, null, null],
            emblem: savedEquip.emblem || null,
            accessories: Array.isArray(savedEquip.accessories) && savedEquip.accessories.length === 3 
                ? [...savedEquip.accessories] 
                : [null, null, null]
        };

        // 보유 룬 목록 확인
        const ownedRunes = getOwnedRunes(charId);
        if (ownedRunes.length === 0) {
            showToast('보유 룬이 없습니다. 룬 목록에서 ⭐를 눌러 추가하세요.', 'error');
            return;
        }

        // 이미 장착된 룬 ID 목록
        const equippedIds = new Set();
        if (equipment.weapon) equippedIds.add(equipment.weapon);
        if (equipment.armors) equipment.armors.forEach(id => { if (id) equippedIds.add(id); });
        if (equipment.emblem) equippedIds.add(equipment.emblem);
        if (equipment.accessories) equipment.accessories.forEach(id => { if (id) equippedIds.add(id); });

        // 카테고리별 빈 슬롯 및 사용 가능한 룬 정리
        const emptySlotInfo = {
            weapon: !equipment.weapon,
            armorCount: equipment.armors.filter(a => !a).length,
            emblem: !equipment.emblem,
            accessoryCount: equipment.accessories.filter(a => !a).length
        };

        const totalEmpty = (emptySlotInfo.weapon ? 1 : 0) + 
                           emptySlotInfo.armorCount + 
                           (emptySlotInfo.emblem ? 1 : 0) + 
                           emptySlotInfo.accessoryCount;

        if (totalEmpty === 0) {
            showToast('모든 슬롯이 장착되어 있습니다.', 'info');
            return;
        }

        // 카테고리별 사용 가능한 보유 룬 (장착되지 않은 것만)
        const availableByCategory = {
            '01': ownedRunes.filter(r => r.category === '01' && !equippedIds.has(r.id)),
            '02': ownedRunes.filter(r => r.category === '02' && !equippedIds.has(r.id)),
            '04': ownedRunes.filter(r => r.category === '04' && !equippedIds.has(r.id)),
            '03': ownedRunes.filter(r => r.category === '03' && !equippedIds.has(r.id))
        };

        // 각 카테고리 효율 점수 순 정렬
        Object.keys(availableByCategory).forEach(cat => {
            availableByCategory[cat].sort((a, b) => (b.baseScore || 0) - (a.baseScore || 0));
        });

        // @debug 2025-12-12 - 자동 장착 디버깅 로그
        console.log('[자동장착] 보유 룬 수:', ownedRunes.length);
        console.log('[자동장착] 사용 가능한 룬:', {
            무기: availableByCategory['01'].length,
            방어구: availableByCategory['02'].length,
            엠블럼: availableByCategory['04'].length,
            장신구: availableByCategory['03'].length
        });
        console.log('[자동장착] 빈 슬롯:', emptySlotInfo);

        let filledCount = 0;
        const newEquipment = {
            weapon: equipment.weapon,
            armors: [...equipment.armors],
            emblem: equipment.emblem,
            accessories: [...equipment.accessories]
        };

        // 무기 슬롯 최적화
        if (emptySlotInfo.weapon && availableByCategory['01'].length > 0) {
            newEquipment.weapon = availableByCategory['01'][0].id;
            filledCount++;
        }

        // 방어구 슬롯 최적화 (최대 5개)
        let armorIdx = 0;
        for (let i = 0; i < 5 && armorIdx < availableByCategory['02'].length; i++) {
            if (!newEquipment.armors[i]) {
                newEquipment.armors[i] = availableByCategory['02'][armorIdx].id;
                armorIdx++;
                filledCount++;
            }
        }

        // 엠블럼 슬롯 최적화
        if (emptySlotInfo.emblem && availableByCategory['04'].length > 0) {
            newEquipment.emblem = availableByCategory['04'][0].id;
            filledCount++;
        }

        // 장신구 슬롯 최적화 (최대 3개)
        let accIdx = 0;
        for (let i = 0; i < 3 && accIdx < availableByCategory['03'].length; i++) {
            if (!newEquipment.accessories[i]) {
                newEquipment.accessories[i] = availableByCategory['03'][accIdx].id;
                accIdx++;
                filledCount++;
            }
        }

        if (filledCount === 0) {
            showToast('사용 가능한 보유 룬이 없습니다.', 'info');
            return;
        }

        // 장착 정보 업데이트
        state.characterEquipments[charId] = newEquipment;
        saveCharacterEquipments();
        renderEquipmentSlots(charId);
        
        // @added 2025-12-12 - 장착 시뮬레이터에도 연동
        syncEquipmentToSimulator(charId, newEquipment);
        
        showToast(`${filledCount}개 슬롯에 최적 룬을 장착했습니다!`, 'success');
    }

    /**
     * 보유 룬 장착 정보를 시뮬레이터에 동기화
     * @param {string} charId - 캐릭터 ID
     * @param {Object} equipment - 장착 정보
     * @added 2025-12-12
     */
    function syncEquipmentToSimulator(charId, equipment) {
        // 시뮬레이터 슬롯 초기화
        state.equippedRunes = {};
        
        // 무기 슬롯 동기화
        if (equipment.weapon) {
            const rune = state.allRunes.find(r => r.id === equipment.weapon);
            if (rune) {
                state.equippedRunes['weapon-1'] = rune;
            }
        }
        
        // 엠블럼 슬롯 동기화
        if (equipment.emblem) {
            const rune = state.allRunes.find(r => r.id === equipment.emblem);
            if (rune) {
                state.equippedRunes['emblem-1'] = rune;
            }
        }
        
        // 방어구 슬롯 동기화 (5개)
        equipment.armors.forEach((runeId, idx) => {
            if (runeId) {
                const rune = state.allRunes.find(r => r.id === runeId);
                if (rune) {
                    state.equippedRunes[`armor-${idx + 1}`] = rune;
                }
            }
        });
        
        // 장신구 슬롯 동기화 (3개)
        equipment.accessories.forEach((runeId, idx) => {
            if (runeId) {
                const rune = state.allRunes.find(r => r.id === runeId);
                if (rune) {
                    state.equippedRunes[`accessory-${idx + 1}`] = rune;
                }
            }
        });
        
        // 시뮬레이터 UI 업데이트
        Object.keys(SLOT_CONFIG).forEach(slotId => renderSlot(slotId));
        calculateTotalEffects();
        renderEquippedRuneList();
        saveEquippedRunes();
    }

    // ============================================
    // 13. 모달 관리 (Modal)
    // ============================================

    /**
     * 장착 탭용 룬 선택 모달 열기
     * @param {string} slotId - 슬롯 ID
     * @param {string} category - 카테고리 코드
     * @added 2025-12-11
     */
    function openEquipmentSelectModal(slotId, category) {
        const modal = $('#rune-select-modal');
        if (!modal) return;

        // 슬롯 정보 저장 (장착 탭용 플래그 추가)
        state.selectedSlot = slotId;
        state.isEquipmentSlot = true;

        // 해당 카테고리의 룬만 필터링
        const categoryRunes = state.allRunes.filter(rune => {
            return rune.category === category;
        }).sort((a, b) => {
            // 효율 점수 순 정렬
            return (b.baseScore || 0) - (a.baseScore || 0);
        });

        renderModalRuneList(categoryRunes);
        modal.classList.add('modal--open');
    }

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
                         src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                         alt="${escapeHtml(rune.name)}"
                         onerror="handleRuneImageError(this)">
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
     * @updated 2025-12-11 - rawDescription, effects 배열 기반 상세 표시
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

        if (titleEl) titleEl.textContent = rune.name;

        // 효과 유형별 색상 맵
        const typeColorMap = {
            'PERMANENT': '#4CAF50',
            'TRIGGER': '#FF9800',
            'STATE': '#2196F3',
            'STACKING': '#9C27B0',
            'DURATION': '#00BCD4',
            'AWAKENING': '#E91E63',
            'DECAY': '#795548'
        };

        // 효과 유형 한글 맵
        const typeNameMap = {
            'PERMANENT': '상시',
            'TRIGGER': '발동',
            'STATE': '상태',
            'STACKING': '중첩',
            'DURATION': '지속',
            'AWAKENING': '각성',
            'DECAY': '감소'
        };

        // 기본 효과 HTML 생성
        let effectsHtml = '';
        if (rune.effects && rune.effects.length > 0) {
            effectsHtml = `
                <div class="rune-detail__effects">
                    <h4 class="rune-detail__effects-title">⚔️ 기본 효과</h4>
                    ${rune.effects.map(effect => {
                        const typeColor = typeColorMap[effect.type] || '#888';
                        const typeName = typeNameMap[effect.type] || effect.type || '기타';
                        const value = effect.value || 0;
                        const unit = effect.unit || '%';
                        const trigger = effect.trigger ? `<div style="font-size:11px;color:#aaa;">⏱️ ${escapeHtml(effect.trigger)}</div>` : '';
                        const note = effect.note ? `<div style="font-size:11px;color:#888;">📝 ${escapeHtml(effect.note)}</div>` : '';
                        return `
                            <div class="rune-detail__effect-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:8px;background:#1a1a3e;border-radius:6px;margin-bottom:6px;">
                                <div style="display:flex;justify-content:space-between;width:100%;">
                                    <span style="display:flex;align-items:center;gap:6px;">
                                        <span style="background:${typeColor};padding:2px 6px;border-radius:3px;font-size:10px;color:#fff;">${typeName}</span>
                                        ${escapeHtml(effect.name || '알 수 없음')}
                                    </span>
                                    <span style="color:#FFD700;font-weight:bold;">+${value}${unit}</span>
                                </div>
                                ${trigger}
                                ${note}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // 강화 효과 HTML 생성
        let enhanceHtml = '';
        if (rune.enhanceEffects) {
            const enhance10 = rune.enhanceEffects['10'] || {};
            const enhance15 = rune.enhanceEffects['15'] || {};
            const hasEnhance = Object.keys(enhance10).length > 0 || Object.keys(enhance15).length > 0;
            
            if (hasEnhance) {
                enhanceHtml = `
                    <div class="rune-detail__effects" style="margin-top:12px;">
                        <h4 class="rune-detail__effects-title">✨ 강화 효과</h4>
                        ${Object.keys(enhance10).length > 0 ? `
                            <div style="margin-bottom:8px;">
                                <span style="background:#FF9800;padding:2px 6px;border-radius:3px;font-size:11px;color:#fff;">+10 강화</span>
                                ${Object.entries(enhance10).map(([name, val]) => `
                                    <div class="rune-detail__effect-item" style="margin-top:4px;">
                                        <span>${escapeHtml(name)}</span>
                                        <span style="color:#FFD700;">+${val}%</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${Object.keys(enhance15).length > 0 ? `
                            <div>
                                <span style="background:#E91E63;padding:2px 6px;border-radius:3px;font-size:11px;color:#fff;">+15 강화</span>
                                ${Object.entries(enhance15).map(([name, val]) => `
                                    <div class="rune-detail__effect-item" style="margin-top:4px;">
                                        <span>${escapeHtml(name)}</span>
                                        <span style="color:#FFD700;">+${val}%</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        }

        // 각성 효과 HTML 생성
        let awakeningHtml = '';
        if (rune.awakening && rune.awakening.effects && rune.awakening.effects.length > 0) {
            awakeningHtml = `
                <div class="rune-detail__effects" style="margin-top:12px;">
                    <h4 class="rune-detail__effects-title">🔥 각성 효과</h4>
                    <div style="font-size:11px;color:#aaa;margin-bottom:6px;">
                        ⏱️ 발동: ${escapeHtml(rune.awakening.trigger || '알 수 없음')} 
                        | 지속: ${rune.awakening.duration || 0}초
                    </div>
                    ${rune.awakening.effects.map(effect => `
                        <div class="rune-detail__effect-item">
                            <span>${escapeHtml(effect.name || '알 수 없음')}</span>
                            <span style="color:#E91E63;">+${effect.value || 0}${effect.unit || '%'}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 결함 효과 HTML 생성
        let demeritHtml = '';
        if (rune.demerits && rune.demerits.length > 0) {
            demeritHtml = `
                <div class="rune-detail__effects" style="margin-top:12px;border-color:#f44336;">
                    <h4 class="rune-detail__effects-title" style="color:#f44336;">⚠️ 결함</h4>
                    ${rune.demerits.map(demerit => `
                        <div class="rune-detail__effect-item">
                            <span>${escapeHtml(demerit.name || '알 수 없음')}</span>
                            <span style="color:#f44336;">-${demerit.value || 0}${demerit.unit || '%'}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 시너지 정보 HTML 생성
        let synergyHtml = '';
        if (rune.synergy) {
            const appliesDot = rune.synergy.appliesDot || [];
            const requiresDot = rune.synergy.requiresDot || [];
            const removesDemerits = rune.synergy.removesDemerits;
            
            if (appliesDot.length > 0 || requiresDot.length > 0 || removesDemerits) {
                synergyHtml = `
                    <div class="rune-detail__effects" style="margin-top:12px;border-color:#9C27B0;">
                        <h4 class="rune-detail__effects-title" style="color:#9C27B0;">🔗 시너지</h4>
                        ${appliesDot.length > 0 ? `
                            <div style="margin-bottom:4px;">
                                <span style="color:#4CAF50;">DoT 부여:</span> ${appliesDot.join(', ')}
                            </div>
                        ` : ''}
                        ${requiresDot.length > 0 ? `
                            <div style="margin-bottom:4px;">
                                <span style="color:#2196F3;">DoT 필요:</span> ${requiresDot.join(', ')}
                            </div>
                        ` : ''}
                        ${removesDemerits ? `
                            <div style="color:#FF9800;">✅ 결함 제거 가능</div>
                        ` : ''}
                    </div>
                `;
            }
        }

        contentEl.innerHTML = `
            <img class="rune-detail__image" 
                 src="${rune.image || DEFAULT_RUNE_IMAGE}" 
                 alt="${escapeHtml(rune.name)}"
                 onerror="handleRuneImageError(this)">
            <h3 class="rune-detail__name">${escapeHtml(rune.name)}</h3>
            <div class="rune-detail__meta">
                <span class="rune-card__badge rune-card__badge--grade rune-card__badge--${gradeInfo.color}">${gradeInfo.name}</span>
                <span class="rune-card__badge rune-card__badge--category">${categoryName}</span>
                <span class="rune-card__badge">${className}</span>
            </div>
            ${effectsHtml}
            ${enhanceHtml}
            ${awakeningHtml}
            ${demeritHtml}
            ${synergyHtml}
            <div class="rune-detail__description" style="margin-top:16px;padding:12px;background:#1a1a3e;border-radius:8px;border-left:3px solid #FFD700;">
                <h4 style="color:#FFD700;margin-bottom:8px;font-size:13px;">📜 원본 설명</h4>
                <p style="font-size:13px;line-height:1.6;color:#ccc;">
                    ${escapeHtml(rune.rawDescription || rune.description || '설명 없음')}
                </p>
            </div>
            ${rune.drop_location ? `
                <div class="rune-detail__effects" style="margin-top:12px;">
                    <h4 class="rune-detail__effects-title">📍 획득처</h4>
                    <p style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">
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

    /**
     * 토스트 알림 표시
     * @param {string} message - 메시지
     * @param {string} type - 타입 ('success', 'error', 'warning')
     * @param {number} duration - 표시 시간 (ms)
     */
    function showToast(message, type = 'success', duration = 3000) {
        const container = $('#toast-container');
        if (!container) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span class="toast__icon">${icons[type] || '📢'}</span>
            <span class="toast__message">${escapeHtml(message)}</span>
            <button class="toast__close">×</button>
        `;

        container.appendChild(toast);

        // 닫기 버튼 이벤트
        toast.querySelector('.toast__close').addEventListener('click', () => {
            toast.remove();
        });

        // 자동 제거
        setTimeout(() => {
            toast.style.animation = 'fadeOut var(--transition-normal)';
            setTimeout(() => toast.remove(), 250);
        }, duration);
    }

    // ============================================
    // 16. 탭 관리 (Tab Management)
    // ============================================

    /**
     * 탭 전환
     * @param {string} tabId - 탭 ID
     */
    function switchTab(tabId) {
        // 탭 버튼 활성화
        $$('.tab-nav__btn').forEach(btn => {
            btn.classList.toggle('tab-nav__btn--active', btn.dataset.tab === tabId);
        });

        // 탭 컨텐츠 활성화
        $$('.tab-content').forEach(content => {
            content.classList.toggle('tab-content--active', content.id === `tab-${tabId}`);
        });

        // 특정 탭 진입 시 추가 동작 @updated 2025-12-11 전역 캐릭터 통합
        if (tabId === 'rune-list') {
            renderRuneList();
        } else if (tabId === 'favorites') {
            renderFavorites();
        } else if (tabId === 'equipment') {
            // 장착 탭 진입 시 전역 캐릭터 기준 UI 업데이트
            updateEquipmentTabUI();
        } else if (tabId === 'recommend') {
            // 추천 탭 진입 시 전역 캐릭터 스텟 적용
            if (state.selectedCharacterId) {
                const profile = state.characterProfiles.find(p => p.id === state.selectedCharacterId);
                if (profile) applyProfileToStatForm(profile);
            }
        }
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

        // ============================================
        // 전역 캐릭터 선택 이벤트 @added 2025-12-11
        // ============================================
        const globalCharDisplay = $('#global-char-display');
        const globalCharList = $('#global-char-list');
        const globalNewCharBtn = $('#btn-global-new-char');

        if (globalCharDisplay) {
            globalCharDisplay.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleGlobalCharDropdown();
            });
        }

        // @updated 2025-12-12 삭제 버튼 클릭 처리 추가
        if (globalCharList) {
            globalCharList.addEventListener('click', function(e) {
                // 삭제 버튼 클릭 처리
                const deleteBtn = e.target.closest('.global-char-item__delete');
                if (deleteBtn && deleteBtn.dataset.deleteId) {
                    e.stopPropagation();
                    confirmDeleteCharacter(deleteBtn.dataset.deleteId);
                    return;
                }
                
                // 캐릭터 선택 처리
                const item = e.target.closest('.global-char-item');
                if (item && item.dataset.charId) {
                    selectGlobalCharacter(item.dataset.charId);
                }
            });
        }

        if (globalNewCharBtn) {
            globalNewCharBtn.addEventListener('click', function() {
                closeGlobalCharDropdown();
                openNewProfileModal();
            });
        }

        // 필터 이벤트 @updated 2025-12-11 - 버튼/체크박스 방식
        const searchInput = $('#search-input');
        const categoryBtnGroup = $('#filter-category');
        const gradeCheckGroup = $('#filter-grade');
        const classBtnGroup = $('#filter-class');
        const resetBtn = $('#btn-reset-filter');

        if (searchInput) {
            searchInput.addEventListener('input', debounce(e => {
                updateFilter('search', e.target.value);
            }, 300));
        }

        // 카테고리 버튼 그룹
        if (categoryBtnGroup) {
            categoryBtnGroup.addEventListener('click', e => {
                const btn = e.target.closest('.filter-btn');
                if (btn) {
                    // 기존 active 제거
                    categoryBtnGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    updateFilter('category', btn.dataset.value);
                }
            });
        }

        // 등급 체크박스 그룹
        if (gradeCheckGroup) {
            gradeCheckGroup.addEventListener('change', e => {
                if (e.target.type === 'checkbox') {
                    // 체크된 등급들 수집
                    const checked = Array.from(gradeCheckGroup.querySelectorAll('input:checked'))
                        .map(cb => cb.value);
                    updateFilter('grade', checked.length > 0 ? checked : ['all']);
                }
            });
        }

        // 클래스 버튼 그룹
        if (classBtnGroup) {
            classBtnGroup.addEventListener('click', e => {
                const btn = e.target.closest('.filter-btn');
                if (btn) {
                    // 기존 active 제거
                    classBtnGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    updateFilter('klass', btn.dataset.value);
                }
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
        const stopRecommendBtn = $('#btn-stop-recommend');
        const resetStatsBtn = $('#btn-reset-stats');
        const applyRecommendBtn = $('#btn-apply-recommend');

        if (recommendBtn) {
            recommendBtn.addEventListener('click', runRecommendation);
        }

        // 탐색 중단 버튼 @added 2025-12-11
        if (stopRecommendBtn) {
            stopRecommendBtn.addEventListener('click', stopOptimization);
        }

        if (resetStatsBtn) {
            resetStatsBtn.addEventListener('click', resetStats);
        }

        if (applyRecommendBtn) {
            applyRecommendBtn.addEventListener('click', applyRecommendations);
        }

        // ============================================
        // 캐릭터 프로필 관리 이벤트 @added 2025-12-11
        // ============================================
        var profileSelect = $('#profile-select');
        var newProfileBtn = $('#btn-new-profile');
        var saveProfileBtn = $('#btn-save-profile');
        var deleteProfileBtn = $('#btn-delete-profile');
        var profileModalClose = $('#profile-modal-close');
        var profileCancelBtn = $('#btn-profile-cancel');
        var profileConfirmBtn = $('#btn-profile-confirm');

        // 프로필 선택
        if (profileSelect) {
            profileSelect.addEventListener('change', function(e) {
                selectProfile(e.target.value);
            });
        }

        // 새 캐릭터 등록 버튼
        if (newProfileBtn) {
            console.log('✅ btn-new-profile 이벤트 바인딩 완료');
            newProfileBtn.addEventListener('click', openNewProfileModal);
        } else {
            console.warn('⚠️ btn-new-profile 요소를 찾을 수 없음');
        }

        // 프로필 저장 버튼
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', saveCurrentProfile);
        }

        // 프로필 삭제 버튼
        if (deleteProfileBtn) {
            deleteProfileBtn.addEventListener('click', deleteCurrentProfile);
        }

        // 프로필 모달 닫기
        if (profileModalClose) {
            profileModalClose.addEventListener('click', closeProfileModal);
        }

        // 프로필 모달 취소 버튼
        if (profileCancelBtn) {
            profileCancelBtn.addEventListener('click', closeProfileModal);
        }

        // 프로필 등록 확인 버튼
        if (profileConfirmBtn) {
            profileConfirmBtn.addEventListener('click', createNewProfile);
        }

        // ============================================
        // 캐릭터 삭제 컨펌 모달 이벤트 @added 2025-12-12
        // ============================================
        var confirmDeleteModalClose = $('#confirm-delete-modal-close');
        var cancelDeleteBtn = $('#btn-cancel-delete');
        var confirmDeleteBtn = $('#btn-confirm-delete');

        if (confirmDeleteModalClose) {
            confirmDeleteModalClose.addEventListener('click', closeConfirmDeleteModal);
        }

        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', closeConfirmDeleteModal);
        }

        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', function() {
                if (state.pendingDeleteCharId) {
                    executeDeleteCharacter(state.pendingDeleteCharId);
                    closeConfirmDeleteModal();
                }
            });
        }

        // 모달 오버레이 클릭 시 닫기
        var confirmDeleteModal = $('#confirm-delete-modal');
        if (confirmDeleteModal) {
            confirmDeleteModal.querySelector('.modal__overlay').addEventListener('click', closeConfirmDeleteModal);
        }

        // ============================================
        // 내 보유 룬 탭 이벤트 @updated 2025-12-11
        // ============================================
        var equipSaveBtn = $('#btn-equipment-save');
        var autoEquipBtn = $('#btn-auto-equip');
        var clearEquipBtn = $('#btn-clear-equip');

        // 저장 버튼
        if (equipSaveBtn) {
            equipSaveBtn.addEventListener('click', function() {
                saveCharacterEquipments();
                saveCharacterOwnedRunes();
                showToast('저장되었습니다.', 'success');
            });
        }

        // 자동 장착 버튼
        if (autoEquipBtn) {
            autoEquipBtn.addEventListener('click', optimizeEmptySlots);
        }

        // 전체 해제 버튼
        if (clearEquipBtn) {
            clearEquipBtn.addEventListener('click', function() {
                if (confirm('모든 장착을 해제하시겠습니까?')) {
                    clearAllEquipment();
                }
            });
        }

        // 장착 미니바 클릭 이벤트 (장착 해제)
        var minibarSlots = $('#equipped-minibar-slots');
        if (minibarSlots) {
            minibarSlots.addEventListener('click', function(e) {
                var item = e.target.closest('.equipped-mini-item');
                if (item && item.dataset.runeId) {
                    unequipRuneById(parseInt(item.dataset.runeId));
                }
            });
        }

        // 보유 룬 목록 클릭 이벤트 위임
        var ownedRunesList = $('#owned-runes-list');
        if (ownedRunesList) {
            ownedRunesList.addEventListener('click', function(e) {
                var btn = e.target.closest('.owned-rune-item__btn');
                var item = e.target.closest('.owned-rune-item');
                
                if (btn && item) {
                    var runeId = parseInt(item.dataset.runeId);
                    var action = btn.dataset.action;
                    
                    if (action === 'equip') {
                        equipRuneFromOwned(runeId, item.dataset.category);
                    } else if (action === 'unequip') {
                        unequipRuneById(runeId);
                    } else if (action === 'remove') {
                        if (confirm('이 룬을 보유 목록에서 삭제하시겠습니까?')) {
                            removeOwnedRune(state.selectedCharacterId, runeId);
                            updateEquipmentTabUI();
                            showToast('보유 목록에서 삭제되었습니다.', 'info');
                        }
                    }
                    return;
                }
                
                // 카드 클릭 시 상세 모달
                if (item && !btn) {
                    openRuneDetailModal(parseInt(item.dataset.runeId));
                }
            });
        }

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
                        // 장착 탭에서 열린 모달인지 확인
                        if (state.isEquipmentSlot) {
                            equipRuneToEquipmentSlot(state.selectedSlot, runeId);
                            state.isEquipmentSlot = false;
                            showToast(rune.name + ' 장착 완료!', 'success');
                        } else {
                            equipRune(state.selectedSlot, rune);
                        }
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
    async function init() {
        console.log('🚀 마비노기 모바일 룬 효율 계산기 초기화 시작...');

        // 저장된 데이터 불러오기
        loadFavorites();
        loadPresets();
        loadCharacterProfiles(); // @added 2025-12-11
        loadCharacterEquipments(); // @added 2025-12-11
        loadCharacterOwnedRunes(); // @added 2025-12-11

        // 이벤트 리스너 설정
        setupEventListeners();

        // 룬 데이터 로드
        await loadRuneData();

        // 장착된 룬 불러오기
        loadEquippedRunes();

        // 페이지네이션 렌더링
        renderPagination();

        console.log('✅ 초기화 완료!');
    }

    // DOMContentLoaded 시 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();