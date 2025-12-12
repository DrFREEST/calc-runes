/**
 * ============================================
 * 캐릭터 프로필 관리 모듈
 * ============================================
 * @file        modules/character-manager.js
 * @description 캐릭터별 스탯, 룬, 옵션 프로필 관리
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.CharacterManager)
 * - StorageManager 모듈 의존
 * 
 * @structure
 * 1. 상수 정의
 * 2. 프로필 CRUD 함수
 * 3. UI 렌더링 함수
 * 4. 이벤트 핸들러
 * 
 * @requires StorageManager
 */

(function() {
    'use strict';

    // ============================================
    // 1. 상수 정의
    // ============================================

    /**
     * 캐릭터 스탯 입력 필드 ID 목록
     * @constant {Array<string>}
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
     */
    const RECOMMEND_OPTION_FIELDS = [
        'recommend-role',
        'recommend-class',
        'recommend-min-grade'
    ];

    /**
     * 기본 캐릭터 프로필 템플릿
     * @constant {Object}
     */
    const DEFAULT_PROFILE = {
        name: '',
        stats: {},
        recommendOptions: {},
        equippedRunes: {},
        enhanceLevels: {},
        createdAt: '',
        updatedAt: ''
    };

    // ============================================
    // 2. 유틸리티 함수
    // ============================================

    /**
     * DOM 요소 선택 헬퍼
     * @param {string} selector - CSS 선택자
     * @returns {Element|null}
     */
    function $(selector) {
        return document.querySelector(selector);
    }

    /**
     * 현재 날짜 문자열 반환
     * @returns {string} YYYY-MM-DD 형식
     */
    function getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * StorageManager 모듈 참조 확인
     * @returns {boolean}
     */
    function isStorageReady() {
        return typeof window.StorageManager !== 'undefined';
    }

    // ============================================
    // 3. 프로필 CRUD 함수
    // ============================================

    /**
     * 모든 캐릭터 프로필 목록 조회
     * @returns {Object} 캐릭터명을 키로 하는 프로필 객체
     */
    function getAllProfiles() {
        if (!isStorageReady()) {
            console.error('[CharacterManager] StorageManager가 로드되지 않았습니다.');
            return {};
        }
        return window.StorageManager.load(
            window.StorageManager.KEYS.CHARACTER_PROFILES,
            {}
        );
    }

    /**
     * 특정 캐릭터 프로필 조회
     * @param {string} characterName - 캐릭터명
     * @returns {Object|null} 프로필 객체 또는 null
     */
    function getProfile(characterName) {
        const profiles = getAllProfiles();
        return profiles[characterName] || null;
    }

    /**
     * 현재 선택된 캐릭터명 조회
     * @returns {string} 캐릭터명 (없으면 빈 문자열)
     */
    function getCurrentCharacter() {
        if (!isStorageReady()) return '';
        return window.StorageManager.load(
            window.StorageManager.KEYS.CURRENT_CHARACTER,
            ''
        );
    }

    /**
     * 현재 선택된 캐릭터 설정
     * @param {string} characterName - 캐릭터명
     */
    function setCurrentCharacter(characterName) {
        if (!isStorageReady()) return;
        window.StorageManager.save(
            window.StorageManager.KEYS.CURRENT_CHARACTER,
            characterName
        );
    }

    /**
     * 현재 화면의 데이터 수집
     * @returns {Object} 현재 스탯, 옵션, 룬, 강화 수치
     */
    function collectCurrentData() {
        const data = {
            stats: {},
            recommendOptions: {},
            equippedRunes: {},
            enhanceLevels: {}
        };

        // 스탯 수집
        CHARACTER_STAT_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element) {
                const value = element.value.trim();
                data.stats[fieldId] = value !== '' ? parseInt(value) || 0 : '';
            }
        });

        // 추천 옵션 수집
        RECOMMEND_OPTION_FIELDS.forEach(function(fieldId) {
            const element = $('#' + fieldId);
            if (element) {
                data.recommendOptions[fieldId] = element.value;
            }
        });

        // 장착된 룬 및 강화 수치는 메인 앱 상태에서 가져옴
        if (window.RuneCalculator && window.RuneCalculator.getState) {
            const appState = window.RuneCalculator.getState();
            data.equippedRunes = appState.equippedRunes || {};
            data.enhanceLevels = appState.enhanceLevels || {};
        }

        return data;
    }

    /**
     * 수집된 데이터를 화면에 적용
     * @param {Object} data - 프로필 데이터
     */
    function applyDataToUI(data) {
        // 스탯 적용
        if (data.stats) {
            CHARACTER_STAT_FIELDS.forEach(function(fieldId) {
                const element = $('#' + fieldId);
                if (element && data.stats.hasOwnProperty(fieldId)) {
                    element.value = data.stats[fieldId] !== '' ? data.stats[fieldId] : '';
                }
            });
        }

        // 추천 옵션 적용
        if (data.recommendOptions) {
            RECOMMEND_OPTION_FIELDS.forEach(function(fieldId) {
                const element = $('#' + fieldId);
                if (element && data.recommendOptions.hasOwnProperty(fieldId)) {
                    element.value = data.recommendOptions[fieldId];
                }
            });
        }

        // 장착된 룬 및 강화 수치 적용
        if (window.RuneCalculator && window.RuneCalculator.loadProfileData) {
            window.RuneCalculator.loadProfileData({
                equippedRunes: data.equippedRunes || {},
                enhanceLevels: data.enhanceLevels || {}
            });
        }
    }

    /**
     * 새 캐릭터 프로필 생성
     * @param {string} characterName - 캐릭터명
     * @param {boolean} [saveCurrentData=false] - 현재 데이터를 저장할지 여부
     * @returns {boolean} 생성 성공 여부
     */
    function createProfile(characterName, saveCurrentData) {
        if (!characterName || characterName.trim() === '') {
            console.warn('[CharacterManager] 캐릭터명이 비어있습니다.');
            return false;
        }

        characterName = characterName.trim();
        const profiles = getAllProfiles();

        // 중복 확인
        if (profiles[characterName]) {
            console.warn('[CharacterManager] 이미 존재하는 캐릭터명:', characterName);
            return false;
        }

        // 새 프로필 생성
        const now = getCurrentDate();
        const newProfile = Object.assign({}, DEFAULT_PROFILE, {
            name: characterName,
            createdAt: now,
            updatedAt: now
        });

        // 현재 데이터 저장 옵션
        if (saveCurrentData) {
            const currentData = collectCurrentData();
            Object.assign(newProfile, currentData);
        }

        // 저장
        profiles[characterName] = newProfile;
        window.StorageManager.save(
            window.StorageManager.KEYS.CHARACTER_PROFILES,
            profiles
        );

        // 현재 캐릭터로 설정
        setCurrentCharacter(characterName);

        console.log('[CharacterManager] 캐릭터 생성:', characterName);
        return true;
    }

    /**
     * 캐릭터 프로필 저장 (업데이트)
     * @param {string} characterName - 캐릭터명
     * @returns {boolean} 저장 성공 여부
     */
    function saveProfile(characterName) {
        if (!characterName) {
            characterName = getCurrentCharacter();
        }

        if (!characterName) {
            console.warn('[CharacterManager] 저장할 캐릭터가 선택되지 않았습니다.');
            return false;
        }

        const profiles = getAllProfiles();
        
        // 프로필이 없으면 새로 생성
        if (!profiles[characterName]) {
            return createProfile(characterName, true);
        }

        // 현재 데이터 수집 및 저장
        const currentData = collectCurrentData();
        profiles[characterName] = Object.assign({}, profiles[characterName], currentData, {
            updatedAt: getCurrentDate()
        });

        window.StorageManager.save(
            window.StorageManager.KEYS.CHARACTER_PROFILES,
            profiles
        );

        console.log('[CharacterManager] 캐릭터 저장:', characterName);
        return true;
    }

    /**
     * 캐릭터 프로필 불러오기
     * @param {string} characterName - 캐릭터명
     * @returns {boolean} 불러오기 성공 여부
     */
    function loadProfile(characterName) {
        const profile = getProfile(characterName);
        
        if (!profile) {
            console.warn('[CharacterManager] 프로필을 찾을 수 없습니다:', characterName);
            return false;
        }

        // 현재 캐릭터 설정
        setCurrentCharacter(characterName);

        // UI에 데이터 적용
        applyDataToUI(profile);

        console.log('[CharacterManager] 캐릭터 불러오기:', characterName);
        return true;
    }

    /**
     * 캐릭터 프로필 삭제
     * @param {string} characterName - 캐릭터명
     * @returns {boolean} 삭제 성공 여부
     */
    function deleteProfile(characterName) {
        const profiles = getAllProfiles();
        
        if (!profiles[characterName]) {
            console.warn('[CharacterManager] 삭제할 프로필이 없습니다:', characterName);
            return false;
        }

        delete profiles[characterName];
        window.StorageManager.save(
            window.StorageManager.KEYS.CHARACTER_PROFILES,
            profiles
        );

        // 현재 캐릭터였다면 선택 해제
        if (getCurrentCharacter() === characterName) {
            setCurrentCharacter('');
        }

        console.log('[CharacterManager] 캐릭터 삭제:', characterName);
        return true;
    }

    /**
     * 캐릭터명 변경
     * @param {string} oldName - 기존 캐릭터명
     * @param {string} newName - 새 캐릭터명
     * @returns {boolean} 변경 성공 여부
     */
    function renameProfile(oldName, newName) {
        if (!newName || newName.trim() === '') {
            return false;
        }

        newName = newName.trim();
        const profiles = getAllProfiles();

        if (!profiles[oldName]) {
            return false;
        }

        if (profiles[newName] && oldName !== newName) {
            console.warn('[CharacterManager] 이미 존재하는 캐릭터명:', newName);
            return false;
        }

        // 프로필 이동
        profiles[newName] = Object.assign({}, profiles[oldName], {
            name: newName,
            updatedAt: getCurrentDate()
        });
        delete profiles[oldName];

        window.StorageManager.save(
            window.StorageManager.KEYS.CHARACTER_PROFILES,
            profiles
        );

        // 현재 캐릭터 업데이트
        if (getCurrentCharacter() === oldName) {
            setCurrentCharacter(newName);
        }

        console.log('[CharacterManager] 캐릭터명 변경:', oldName, '->', newName);
        return true;
    }

    /**
     * 캐릭터 목록 조회 (이름만)
     * @returns {Array<string>} 캐릭터명 배열
     */
    function getCharacterList() {
        const profiles = getAllProfiles();
        return Object.keys(profiles).sort();
    }

    /**
     * 프로필 개수 조회
     * @returns {number}
     */
    function getProfileCount() {
        return getCharacterList().length;
    }

    // ============================================
    // 4. UI 렌더링 함수
    // ============================================

    /**
     * 캐릭터 선택 드롭다운 렌더링
     */
    function renderCharacterSelector() {
        const selector = $('#character-selector');
        if (!selector) return;

        const characters = getCharacterList();
        const currentChar = getCurrentCharacter();

        let optionsHtml = '<option value="">-- 캐릭터 선택 --</option>';
        
        characters.forEach(function(name) {
            const selected = name === currentChar ? ' selected' : '';
            optionsHtml += '<option value="' + escapeHtml(name) + '"' + selected + '>' + 
                          escapeHtml(name) + '</option>';
        });

        selector.innerHTML = optionsHtml;
    }

    /**
     * HTML 특수문자 이스케이프
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 캐릭터 관리 영역 표시 업데이트
     */
    function updateCharacterDisplay() {
        const currentChar = getCurrentCharacter();
        const displayEl = $('#current-character-name');
        const countEl = $('#character-count');

        if (displayEl) {
            displayEl.textContent = currentChar || '선택된 캐릭터 없음';
        }

        if (countEl) {
            countEl.textContent = getProfileCount();
        }

        renderCharacterSelector();
    }

    // ============================================
    // 5. 이벤트 핸들러 설정
    // ============================================

    /**
     * 캐릭터 관리 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 캐릭터 선택 변경
        const selector = $('#character-selector');
        if (selector) {
            selector.addEventListener('change', function(e) {
                const characterName = e.target.value;
                if (characterName) {
                    loadProfile(characterName);
                    showToast('"' + characterName + '" 캐릭터를 불러왔습니다.', 'success');
                }
                updateCharacterDisplay();
            });
        }

        // 캐릭터 추가 버튼
        const addBtn = $('#btn-add-character');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                const name = prompt('새 캐릭터 이름을 입력하세요:');
                if (name && name.trim()) {
                    if (createProfile(name.trim(), false)) {
                        updateCharacterDisplay();
                        showToast('"' + name.trim() + '" 캐릭터가 생성되었습니다.', 'success');
                    } else {
                        showToast('캐릭터 생성에 실패했습니다. 이름이 중복되었을 수 있습니다.', 'error');
                    }
                }
            });
        }

        // 캐릭터 저장 버튼
        const saveBtn = $('#btn-save-character');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                const currentChar = getCurrentCharacter();
                if (!currentChar) {
                    // 선택된 캐릭터가 없으면 새로 생성
                    const name = prompt('저장할 캐릭터 이름을 입력하세요:');
                    if (name && name.trim()) {
                        if (createProfile(name.trim(), true)) {
                            updateCharacterDisplay();
                            showToast('"' + name.trim() + '" 캐릭터로 저장되었습니다.', 'success');
                        }
                    }
                } else {
                    if (saveProfile(currentChar)) {
                        showToast('"' + currentChar + '" 캐릭터가 저장되었습니다.', 'success');
                    }
                }
            });
        }

        // 캐릭터 삭제 버튼
        const deleteBtn = $('#btn-delete-character');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                const currentChar = getCurrentCharacter();
                if (!currentChar) {
                    showToast('삭제할 캐릭터를 선택해주세요.', 'warning');
                    return;
                }

                if (confirm('"' + currentChar + '" 캐릭터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
                    if (deleteProfile(currentChar)) {
                        updateCharacterDisplay();
                        showToast('캐릭터가 삭제되었습니다.', 'success');
                    }
                }
            });
        }
    }

    /**
     * 토스트 알림 표시 (메인 앱 함수 호출)
     * @param {string} message
     * @param {string} type
     */
    function showToast(message, type) {
        if (window.RuneCalculator && window.RuneCalculator.showToast) {
            window.RuneCalculator.showToast(message, type);
        } else {
            console.log('[Toast]', type, message);
        }
    }

    // ============================================
    // 6. 초기화
    // ============================================

    /**
     * 모듈 초기화
     */
    function init() {
        if (!isStorageReady()) {
            console.error('[CharacterManager] StorageManager가 필요합니다.');
            return;
        }

        setupEventListeners();
        updateCharacterDisplay();

        // 저장된 캐릭터가 있으면 자동 불러오기
        const currentChar = getCurrentCharacter();
        if (currentChar && getProfile(currentChar)) {
            loadProfile(currentChar);
        }

        console.log('✅ CharacterManager 모듈 초기화 완료');
    }

    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * CharacterManager 전역 객체
     * @global
     */
    window.CharacterManager = {
        // 상수
        STAT_FIELDS: CHARACTER_STAT_FIELDS,
        OPTION_FIELDS: RECOMMEND_OPTION_FIELDS,

        // 프로필 관리
        getAll: getAllProfiles,
        get: getProfile,
        create: createProfile,
        save: saveProfile,
        load: loadProfile,
        delete: deleteProfile,
        rename: renameProfile,

        // 현재 캐릭터
        getCurrent: getCurrentCharacter,
        setCurrent: setCurrentCharacter,

        // 목록
        getList: getCharacterList,
        getCount: getProfileCount,

        // UI
        renderSelector: renderCharacterSelector,
        updateDisplay: updateCharacterDisplay,

        // 데이터 수집/적용
        collectData: collectCurrentData,
        applyData: applyDataToUI,

        // 초기화
        init: init
    };

    console.log('✅ CharacterManager 모듈 로드 완료');

})();
