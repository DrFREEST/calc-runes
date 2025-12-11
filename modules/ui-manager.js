/**
 * ============================================
 * UI 관리 모듈
 * ============================================
 * @file        modules/ui-manager.js
 * @description 토스트 알림, 모달, 탭 관리
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.UIManager)
 * - 공통 UI 컴포넌트 관리
 * 
 * @requires Utils
 */

(function() {
    'use strict';

    // ============================================
    // 1. 토스트 알림
    // ============================================

    /**
     * 토스트 알림 표시
     * @param {string} message - 메시지
     * @param {string} [type='success'] - 타입 ('success', 'error', 'warning', 'info')
     * @param {number} [duration=3000] - 표시 시간 (ms)
     */
    function showToast(message, type, duration) {
        type = type || 'success';
        duration = duration || 3000;

        var container = document.querySelector('#toast-container');
        if (!container) {
            console.warn('[UIManager] 토스트 컨테이너가 없습니다.');
            return;
        }

        var icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        var toast = document.createElement('div');
        toast.className = 'toast toast--' + type;
        toast.innerHTML = 
            '<span class="toast__icon">' + (icons[type] || '📢') + '</span>' +
            '<span class="toast__message">' + escapeHtml(message) + '</span>' +
            '<button class="toast__close">×</button>';

        container.appendChild(toast);

        // 닫기 버튼 이벤트
        var closeBtn = toast.querySelector('.toast__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                toast.remove();
            });
        }

        // 자동 제거
        setTimeout(function() {
            toast.style.animation = 'fadeOut var(--transition-normal)';
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 250);
        }, duration);
    }

    /**
     * HTML 이스케이프 (내부용)
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // 2. 모달 관리
    // ============================================

    /**
     * 모달 열기
     * @param {string} modalId - 모달 요소 ID
     */
    function openModal(modalId) {
        var modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('modal--open');
        }
    }

    /**
     * 모달 닫기
     * @param {string} modalId - 모달 요소 ID
     */
    function closeModal(modalId) {
        var modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('modal--open');
        }
    }

    /**
     * 모든 모달 닫기
     */
    function closeAllModals() {
        var modals = document.querySelectorAll('.modal--open');
        modals.forEach(function(modal) {
            modal.classList.remove('modal--open');
        });
    }

    /**
     * 확인 모달 표시
     * @param {string} message - 확인 메시지
     * @param {Function} onConfirm - 확인 콜백
     * @param {Function} [onCancel] - 취소 콜백
     */
    function confirmModal(message, onConfirm, onCancel) {
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
    }

    // ============================================
    // 3. 탭 관리
    // ============================================

    /**
     * 탭 전환
     * @param {string} tabId - 탭 ID
     * @param {Function} [onSwitch] - 전환 후 콜백
     */
    function switchTab(tabId, onSwitch) {
        // 탭 버튼 활성화
        var tabBtns = document.querySelectorAll('.tab-nav__btn');
        tabBtns.forEach(function(btn) {
            var isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('tab-nav__btn--active', isActive);
        });

        // 탭 컨텐츠 활성화
        var tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(function(content) {
            var isActive = content.id === 'tab-' + tabId;
            content.classList.toggle('tab-content--active', isActive);
        });

        // 콜백 실행
        if (onSwitch) {
            onSwitch(tabId);
        }
    }

    /**
     * 현재 활성 탭 ID 반환
     * @returns {string|null}
     */
    function getActiveTab() {
        var activeBtn = document.querySelector('.tab-nav__btn--active');
        return activeBtn ? activeBtn.dataset.tab : null;
    }

    // ============================================
    // 4. 로딩 표시
    // ============================================

    /**
     * 로딩 표시 시작
     * @param {string|Element} container - 컨테이너 선택자 또는 요소
     * @param {string} [message='로딩 중...'] - 로딩 메시지
     */
    function showLoading(container, message) {
        message = message || '로딩 중...';
        
        var el = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
            
        if (!el) return;

        el.innerHTML = 
            '<div class="loading-indicator">' +
            '<div class="loading-indicator__spinner"></div>' +
            '<p>' + escapeHtml(message) + '</p>' +
            '</div>';
    }

    /**
     * 로딩 표시 제거
     * @param {string|Element} container - 컨테이너 선택자 또는 요소
     */
    function hideLoading(container) {
        var el = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
            
        if (!el) return;

        var loading = el.querySelector('.loading-indicator');
        if (loading) {
            loading.remove();
        }
    }

    // ============================================
    // 5. 스크롤 관리
    // ============================================

    /**
     * 요소로 스크롤
     * @param {string|Element} target - 대상 선택자 또는 요소
     * @param {Object} [options] - 스크롤 옵션
     */
    function scrollToElement(target, options) {
        options = options || { behavior: 'smooth', block: 'start' };
        
        var el = typeof target === 'string' 
            ? document.querySelector(target) 
            : target;
            
        if (el) {
            el.scrollIntoView(options);
        }
    }

    /**
     * 페이지 최상단으로 스크롤
     */
    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * UIManager 전역 객체
     * @global
     */
    window.UIManager = {
        // 토스트
        showToast: showToast,
        toast: showToast, // 별칭

        // 모달
        openModal: openModal,
        closeModal: closeModal,
        closeAllModals: closeAllModals,
        confirm: confirmModal,

        // 탭
        switchTab: switchTab,
        getActiveTab: getActiveTab,

        // 로딩
        showLoading: showLoading,
        hideLoading: hideLoading,

        // 스크롤
        scrollToElement: scrollToElement,
        scrollToTop: scrollToTop
    };

    console.log('✅ UIManager 모듈 로드 완료');

})();
