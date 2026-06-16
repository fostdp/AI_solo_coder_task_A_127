(function (window) {
    'use strict';

    var AlertPanel = {};

    var _alertListEl = null;
    var _alertBadgeEl = null;
    var _alertCountEl = null;
    var _onResolveCallback = null;
    var _alerts = [];
    var _MAX_ALERTS = 50;

    AlertPanel.init = function (alertListId, alertBadgeId, alertCountId) {
        _alertListEl = document.getElementById(alertListId);
        _alertBadgeEl = document.getElementById(alertBadgeId);
        _alertCountEl = document.getElementById(alertCountId);

        if (!_alertListEl) {
            console.warn('AlertPanel: alertList element not found:', alertListId);
        }
        if (!_alertBadgeEl) {
            console.warn('AlertPanel: alertBadge element not found:', alertBadgeId);
        }
        if (!_alertCountEl) {
            console.warn('AlertPanel: alertCount element not found:', alertCountId);
        }

        _renderAll();
        _updateCounts();
    };

    AlertPanel.addAlert = function (alertObj) {
        if (!alertObj || typeof alertObj !== 'object') {
            console.warn('AlertPanel: invalid alert object');
            return;
        }

        var alert = {
            id: alertObj.id || ('alert_' + Date.now() + '_' + Math.floor(Math.random() * 10000)),
            alertType: alertObj.alertType || 'unknown',
            alertLevel: alertObj.alertLevel || 'warning',
            message: alertObj.message || '',
            createdAt: alertObj.createdAt || new Date().toISOString(),
            loomCode: alertObj.loomCode || '',
            resolved: alertObj.resolved === true ? true : false
        };

        _alerts.unshift(alert);

        if (_alerts.length > _MAX_ALERTS) {
            _alerts = _alerts.slice(0, _MAX_ALERTS);
        }

        _renderAll();
        _updateCounts();
    };

    AlertPanel.resolveAlert = function (alertId) {
        var found = false;
        for (var i = 0; i < _alerts.length; i++) {
            if (_alerts[i].id === alertId && !_alerts[i].resolved) {
                _alerts[i].resolved = true;
                found = true;
                break;
            }
        }

        if (found) {
            _renderAll();
            _updateCounts();
        }
    };

    AlertPanel.clearAll = function () {
        _alerts = [];
        _renderAll();
        _updateCounts();
    };

    AlertPanel.setOnResolveCallback = function (cb) {
        if (typeof cb === 'function') {
            _onResolveCallback = cb;
        }
    };

    function _updateCounts() {
        var unresolved = 0;
        for (var i = 0; i < _alerts.length; i++) {
            if (!_alerts[i].resolved) unresolved++;
        }

        if (_alertCountEl) {
            _alertCountEl.textContent = unresolved.toString();
        }

        if (_alertBadgeEl) {
            if (unresolved > 0) {
                _alertBadgeEl.textContent = unresolved.toString();
                _alertBadgeEl.style.display = '';
            } else {
                _alertBadgeEl.textContent = '0';
                _alertBadgeEl.style.display = 'none';
            }
        }
    }

    function _formatDate(isoStr) {
        try {
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var y = d.getFullYear();
            var m = _pad2(d.getMonth() + 1);
            var day = _pad2(d.getDate());
            var h = _pad2(d.getHours());
            var mi = _pad2(d.getMinutes());
            var s = _pad2(d.getSeconds());
            return y + '-' + m + '-' + day + ' ' + h + ':' + mi + ':' + s;
        } catch (e) {
            return isoStr;
        }
    }

    function _pad2(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function _getAlertTypeLabel(type) {
        var labelMap = {
            'tension': '张力异常',
            'break': '断纱告警',
            'shed': '梭口异常',
            'pattern': '组织偏差',
            'temperature': '温度告警',
            'speed': '速度异常',
            'unknown': '未知告警'
        };
        return labelMap[type] || (type || '未知');
    }

    function _getAlertTypeColor(type) {
        var colorMap = {
            'tension': '#8e44ad',
            'break': '#c0392b',
            'shed': '#d35400',
            'pattern': '#16a085',
            'temperature': '#e67e22',
            'speed': '#2980b9',
            'unknown': '#7f8c8d'
        };
        return colorMap[type] || '#7f8c8d';
    }

    function _renderAll() {
        if (!_alertListEl) return;

        _alertListEl.innerHTML = '';

        if (_alerts.length === 0) {
            var emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'padding: 30px 20px; text-align: center; color: #95a5a6; font-size: 13px;';
            emptyDiv.textContent = '暂无告警信息';
            _alertListEl.appendChild(emptyDiv);
            return;
        }

        for (var i = 0; i < _alerts.length; i++) {
            var alertEl = _createAlertItem(_alerts[i]);
            _alertListEl.appendChild(alertEl);
        }
    }

    function _createAlertItem(alert) {
        var wrap = document.createElement('div');
        wrap.setAttribute('data-alert-id', alert.id);

        var isCritical = alert.alertLevel === 'critical';
        var isWarning = alert.alertLevel === 'warning';
        var isResolved = alert.resolved === true;

        var borderColor = isCritical ? '#e74c3c' : (isWarning ? '#e67e22' : '#3498db');
        var bgColor = isCritical ? '#fdf0ef' : (isWarning ? '#fdf6ec' : '#eef5fc');

        if (isResolved) {
            borderColor = '#bdc3c7';
            bgColor = '#f8f9fa';
        }

        wrap.style.cssText = [
            'border-left: 4px solid ' + borderColor,
            'background: ' + bgColor,
            'margin: 8px 10px',
            'padding: 10px 12px',
            'border-radius: 4px',
            'box-shadow: 0 1px 3px rgba(0,0,0,0.08)',
            'transition: all 0.2s ease',
            'opacity: ' + (isResolved ? '0.7' : '1')
        ].join(';');

        var topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';

        var leftTags = document.createElement('div');
        leftTags.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';

        var typeBadge = document.createElement('span');
        typeBadge.textContent = _getAlertTypeLabel(alert.alertType);
        typeBadge.style.cssText = [
            'display: inline-block',
            'padding: 2px 8px',
            'border-radius: 10px',
            'font-size: 11px',
            'font-weight: bold',
            'color: #fff',
            'background: ' + _getAlertTypeColor(alert.alertType)
        ].join(';');
        leftTags.appendChild(typeBadge);

        var levelBadge = document.createElement('span');
        var levelText = isCritical ? '严重' : (isWarning ? '警告' : '提示');
        var levelBg = isCritical ? '#e74c3c' : (isWarning ? '#e67e22' : '#3498db');
        levelBadge.textContent = levelText;
        levelBadge.style.cssText = [
            'display: inline-block',
            'padding: 2px 8px',
            'border-radius: 10px',
            'font-size: 11px',
            'font-weight: bold',
            'color: #fff',
            'background: ' + (isResolved ? '#95a5a6' : levelBg)
        ].join(';');
        leftTags.appendChild(levelBadge);

        if (alert.loomCode) {
            var loomBadge = document.createElement('span');
            loomBadge.textContent = alert.loomCode;
            loomBadge.style.cssText = [
                'display: inline-block',
                'padding: 2px 8px',
                'border-radius: 10px',
                'font-size: 11px',
                'color: #2c3e50',
                'background: #ecf0f1',
                'font-family: monospace'
            ].join(';');
            leftTags.appendChild(loomBadge);
        }

        topRow.appendChild(leftTags);

        var timeSpan = document.createElement('span');
        timeSpan.textContent = _formatDate(alert.createdAt);
        timeSpan.style.cssText = 'font-size: 11px; color: #7f8c8d; white-space: nowrap; margin-left: 8px;';
        topRow.appendChild(timeSpan);

        wrap.appendChild(topRow);

        var msgRow = document.createElement('div');
        msgRow.style.cssText = [
            'font-size: 13px',
            'color: ' + (isResolved ? '#95a5a6' : '#2c3e50'),
            'line-height: 1.5',
            'margin-bottom: 8px',
            isResolved ? 'text-decoration: line-through;' : ''
        ].join(';');
        msgRow.textContent = alert.message || '(无描述)';
        wrap.appendChild(msgRow);

        var bottomRow = document.createElement('div');
        bottomRow.style.cssText = 'display: flex; justify-content: flex-end; align-items: center;';

        if (!isResolved) {
            var resolveBtn = document.createElement('button');
            resolveBtn.textContent = '处理';
            resolveBtn.type = 'button';
            resolveBtn.setAttribute('data-alert-id', alert.id);
            resolveBtn.style.cssText = [
                'padding: 4px 14px',
                'font-size: 12px',
                'border: none',
                'border-radius: 4px',
                'cursor: pointer',
                'background: #27ae60',
                'color: #fff',
                'font-weight: bold',
                'transition: background 0.2s'
            ].join(';');

            resolveBtn.addEventListener('mouseenter', function () {
                this.style.background = '#229954';
            });
            resolveBtn.addEventListener('mouseleave', function () {
                this.style.background = '#27ae60';
            });
            resolveBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var aid = this.getAttribute('data-alert-id');
                AlertPanel.resolveAlert(aid);
                if (_onResolveCallback) {
                    try {
                        _onResolveCallback(aid);
                    } catch (cbErr) {
                        console.error('AlertPanel resolve callback error:', cbErr);
                    }
                }
            });

            bottomRow.appendChild(resolveBtn);
        } else {
            var resolvedTag = document.createElement('span');
            resolvedTag.textContent = '✓ 已处理';
            resolvedTag.style.cssText = 'font-size: 11px; color: #27ae60; font-weight: bold;';
            bottomRow.appendChild(resolvedTag);
        }

        wrap.appendChild(bottomRow);

        return wrap;
    }

    window.AlertPanel = AlertPanel;

})(window);
