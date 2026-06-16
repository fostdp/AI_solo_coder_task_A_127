(function (window) {
    'use strict';

    var FabricAnalysis = {};

    function getCanvas(canvasId) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas not found:', canvasId);
            return null;
        }
        return canvas;
    }

    function getCtx(canvas) {
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        return ctx;
    }

    FabricAnalysis.drawTensionDistribution = function (canvasId, tensionArray) {
        var canvas = getCanvas(canvasId);
        if (!canvas || !tensionArray || tensionArray.length === 0) return;

        var rect = canvas.getBoundingClientRect();
        var ctx = getCtx(canvas);
        var W = rect.width;
        var H = rect.height;

        ctx.clearRect(0, 0, W, H);

        var padding = { top: 30, right: 30, bottom: 40, left: 50 };
        var chartW = W - padding.left - padding.right;
        var chartH = H - padding.top - padding.bottom;

        var n = tensionArray.length;
        var barWidth = Math.max(2, chartW / n - 1);

        var maxTension = Math.max.apply(null, tensionArray);
        if (maxTension < 5.0) maxTension = 5.0;
        var yScale = chartH / maxTension;

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartH);
        ctx.lineTo(padding.left + chartW, padding.top + chartH);
        ctx.stroke();

        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        var yTicks = 5;
        for (var i = 0; i <= yTicks; i++) {
            var yVal = (maxTension * i) / yTicks;
            var yPos = padding.top + chartH - yVal * yScale;
            ctx.fillText(yVal.toFixed(1), padding.left - 8, yPos + 4);
            ctx.strokeStyle = '#eee';
            ctx.beginPath();
            ctx.moveTo(padding.left, yPos);
            ctx.lineTo(padding.left + chartW, yPos);
            ctx.stroke();
        }

        var stepLabel = Math.max(1, Math.floor(n / 10));
        ctx.textAlign = 'center';
        for (var j = 0; j < n; j += stepLabel) {
            var xPos = padding.left + (j + 0.5) * (chartW / n);
            ctx.fillText(j.toString(), xPos, padding.top + chartH + 16);
        }

        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('经纱编号', padding.left + chartW / 2, H - 5);
        ctx.save();
        ctx.translate(12, padding.top + chartH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('张力值', 0, 0);
        ctx.restore();

        for (var k = 0; k < n; k++) {
            var t = tensionArray[k];
            var bx = padding.left + k * (chartW / n);
            var bh = t * yScale;
            var by = padding.top + chartH - bh;

            if (t < 0.5) {
                ctx.fillStyle = '#e74c3c';
            } else if (t > 5.0) {
                ctx.fillStyle = '#f1c40f';
            } else {
                ctx.fillStyle = '#27ae60';
            }

            ctx.fillRect(bx + 1, by, barWidth, bh);

            if (t < 0.5) {
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 1;
                var breakY = by + bh / 2;
                ctx.beginPath();
                ctx.moveTo(bx + 1, breakY - 3);
                ctx.lineTo(bx + barWidth, breakY + 3);
                ctx.moveTo(bx + 1, breakY + 3);
                ctx.lineTo(bx + barWidth, breakY - 3);
                ctx.stroke();
            }
        }

        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        var legendX = padding.left + chartW - 180;
        var legendY = padding.top + 5;

        ctx.fillStyle = '#27ae60';
        ctx.fillRect(legendX, legendY, 12, 12);
        ctx.fillStyle = '#333';
        ctx.fillText('正常(0.5-5.0)', legendX + 18, legendY + 10);

        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(legendX, legendY + 16, 12, 12);
        ctx.fillStyle = '#333';
        ctx.fillText('断点(<0.5)', legendX + 18, legendY + 26);

        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(legendX, legendY + 32, 12, 12);
        ctx.fillStyle = '#333';
        ctx.fillText('异常(>5.0)', legendX + 18, legendY + 42);
    };

    FabricAnalysis.drawShedOpening = function (canvasId, shedArray) {
        var canvas = getCanvas(canvasId);
        if (!canvas || !shedArray || shedArray.length === 0) return;

        var rect = canvas.getBoundingClientRect();
        var ctx = getCtx(canvas);
        var W = rect.width;
        var H = rect.height;

        ctx.clearRect(0, 0, W, H);

        var n = shedArray.length;
        var leftPad = 40;
        var rightPad = 80;
        var topPad = 30;
        var botPad = 30;
        var midY = H / 2;
        var plotW = W - leftPad - rightPad;
        var shedHeight = (H - topPad - botPad) / 2 - 10;

        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1.5;

        for (var i = 0; i < n; i++) {
            var xStart = leftPad;
            var xEnd = leftPad + plotW;
            var xRatio = n > 1 ? i / (n - 1) : 0;
            var x = xStart + xRatio * plotW;

            if (shedArray[i] === 1) {
                var y1 = midY - shedHeight;
                var y2 = midY - shedHeight;
                var yMid = midY - 5;

                ctx.beginPath();
                ctx.moveTo(xStart, midY);
                ctx.quadraticCurveTo(leftPad + plotW * 0.3, y1, x, y1);
                ctx.quadraticCurveTo(leftPad + plotW * 0.7, y2, xEnd, midY);
                ctx.stroke();
            } else {
                var y1b = midY + shedHeight;
                var y2b = midY + shedHeight;

                ctx.beginPath();
                ctx.moveTo(xStart, midY);
                ctx.quadraticCurveTo(leftPad + plotW * 0.3, y1b, x, y1b);
                ctx.quadraticCurveTo(leftPad + plotW * 0.7, y2b, xEnd, midY);
                ctx.stroke();
            }
        }

        ctx.fillStyle = 'rgba(100, 149, 237, 0.25)';
        ctx.strokeStyle = 'rgba(65, 105, 225, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        var cx1 = leftPad + plotW * 0.15;
        var cx2 = leftPad + plotW * 0.85;
        ctx.moveTo(cx1, midY);
        ctx.lineTo((cx1 + cx2) / 2, midY - shedHeight + 10);
        ctx.lineTo(cx2, midY);
        ctx.lineTo((cx1 + cx2) / 2, midY + shedHeight - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        var arrowX = leftPad + plotW + 10;
        var arrowStartY = midY - 20;
        var arrowEndY = midY + 20;

        ctx.strokeStyle = '#d35400';
        ctx.fillStyle = '#d35400';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowStartY);
        ctx.lineTo(arrowX, arrowEndY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(arrowX - 6, arrowStartY + 10);
        ctx.lineTo(arrowX, arrowStartY);
        ctx.lineTo(arrowX + 6, arrowStartY + 10);
        ctx.closePath();
        ctx.fill();

        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#d35400';
        ctx.textAlign = 'left';
        ctx.fillText('纬纱', arrowX + 10, midY + 4);

        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('上层经纱 (shed=1)', W / 2, topPad - 10);
        ctx.fillText('下层经纱 (shed=0)', W / 2, H - botPad + 18);

        ctx.fillStyle = '#7f8c8d';
        ctx.font = '10px sans-serif';
        ctx.fillText('织口', leftPad, midY + 15);
        ctx.fillText('卷取', leftPad + plotW, midY + 15);
    };

    FabricAnalysis.drawInterlacementMatrix = function (canvasId, matrix, maxShow) {
        var canvas = getCanvas(canvasId);
        if (!canvas || !matrix) return;

        maxShow = maxShow || 200;
        var rect = canvas.getBoundingClientRect();
        var ctx = getCtx(canvas);
        var W = rect.width;
        var H = rect.height;

        ctx.clearRect(0, 0, W, H);

        var warpCount = Math.min(matrix.length, maxShow);
        var weftCount = matrix.length > 0 ? Math.min(matrix[0].length, maxShow) : 0;

        if (warpCount === 0 || weftCount === 0) return;

        var labelW = 80;
        var cellSize = Math.min(6, Math.max(4, Math.floor(Math.min((W - labelW - 10) / warpCount, (H - 40) / weftCount))));
        var totalW = warpCount * cellSize;
        var totalH = weftCount * cellSize;
        var offsetX = 5;
        var offsetY = 30;

        var colors = {
            warp: '#DAA520',
            weft: '#8B4513'
        };

        for (var w = 0; w < warpCount; w++) {
            for (var f = 0; f < weftCount; f++) {
                var val = matrix[w][f];
                ctx.fillStyle = val === 1 ? colors.warp : colors.weft;
                ctx.fillRect(offsetX + w * cellSize, offsetY + f * cellSize, cellSize, cellSize);
            }
        }

        if (cellSize >= 3) {
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            for (var i = 0; i <= warpCount; i++) {
                ctx.beginPath();
                ctx.moveTo(offsetX + i * cellSize, offsetY);
                ctx.lineTo(offsetX + i * cellSize, offsetY + totalH);
                ctx.stroke();
            }
            for (var j = 0; j <= weftCount; j++) {
                ctx.beginPath();
                ctx.moveTo(offsetX, offsetY + j * cellSize);
                ctx.lineTo(offsetX + totalW, offsetY + j * cellSize);
                ctx.stroke();
            }
        }

        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('当前纬纱行:', offsetX + totalW + 8, offsetY + 20);
        ctx.font = '10px monospace';
        var labelY = offsetY + 40;
        var step = Math.max(1, Math.floor(cellSize / 1));
        for (var r = 0; r < weftCount && labelY < offsetY + totalH + 20; r += step) {
            var rowColor = '#DAA520';
            var rowText = '第' + r + '行: ';
            var bits = '';
            var endCol = Math.min(warpCount, 32);
            for (var c = 0; c < endCol; c++) {
                bits += (matrix[c][r] === 1 ? '█' : '░');
            }
            if (warpCount > endCol) bits += '...';
            ctx.fillStyle = rowColor;
            ctx.fillText(rowText + bits, offsetX + totalW + 8, labelY);
            labelY += Math.max(12, cellSize * step);
        }

        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('经→', offsetX, offsetY - 8);
        ctx.save();
        ctx.translate(offsetX - 15, offsetY + totalH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('纬↓', 0, 0);
        ctx.restore();

        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        var legX = offsetX + 80;
        var legY = offsetY - 12;
        ctx.fillStyle = colors.warp;
        ctx.fillRect(legX, legY, 10, 10);
        ctx.fillStyle = '#333';
        ctx.fillText('经浮点', legX + 14, legY + 9);
        ctx.fillStyle = colors.weft;
        ctx.fillRect(legX + 70, legY, 10, 10);
        ctx.fillStyle = '#333';
        ctx.fillText('纬浮点', legX + 84, legY + 9);
    };

    FabricAnalysis.generateFFT = function (matrix) {
        if (!matrix || matrix.length === 0) {
            return { spectrum2D: new Float32Array(0), warpFreq: [], weftFreq: [] };
        }

        var W = matrix.length;
        var H = matrix[0].length;

        var M = W;
        var N = H;
        if (M > 64) M = 64;
        if (N > 64) N = 64;

        function dct1D(arr, len) {
            var result = new Float32Array(len);
            for (var k = 0; k < len; k++) {
                var sum = 0;
                for (var n = 0; n < len; n++) {
                    sum += arr[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * len));
                }
                var c = (k === 0) ? Math.sqrt(1 / len) : Math.sqrt(2 / len);
                result[k] = c * sum;
            }
            return result;
        }

        var rowDCT = [];
        for (var i = 0; i < M; i++) {
            var row = new Float32Array(N);
            for (var j = 0; j < N; j++) {
                row[j] = matrix[i % W][j % H];
            }
            rowDCT.push(dct1D(row, N));
        }

        var spectrum2D = new Float32Array(M * N);
        for (var jj = 0; jj < N; jj++) {
            var col = new Float32Array(M);
            for (var ii = 0; ii < M; ii++) {
                col[ii] = rowDCT[ii][jj];
            }
            var colDCT = dct1D(col, M);
            for (var iii = 0; iii < M; iii++) {
                var val = Math.abs(colDCT[iii]);
                spectrum2D[iii * N + jj] = val;
            }
        }

        var warpFreqSpectrum = new Float32Array(M);
        for (var a = 0; a < M; a++) {
            var s = 0;
            for (var b = 0; b < N; b++) {
                s += spectrum2D[a * N + b];
            }
            warpFreqSpectrum[a] = s / N;
        }

        var weftFreqSpectrum = new Float32Array(N);
        for (var bb = 0; bb < N; bb++) {
            var ss = 0;
            for (var aa = 0; aa < M; aa++) {
                ss += spectrum2D[aa * N + bb];
            }
            weftFreqSpectrum[bb] = ss / M;
        }

        function findTopFreq(spectrum, skipDC, count) {
            skipDC = skipDC || 2;
            count = count || 5;
            var indices = [];
            var vals = [];
            for (var i = skipDC; i < spectrum.length; i++) {
                indices.push(i);
                vals.push(spectrum[i]);
            }
            var combined = indices.map(function (idx, pos) {
                return { idx: idx, val: vals[pos] };
            });
            combined.sort(function (x, y) { return y.val - x.val; });
            return combined.slice(0, count).map(function (o) { return o.idx; });
        }

        return {
            spectrum2D: spectrum2D,
            warpFreq: findTopFreq(warpFreqSpectrum, 2, 5),
            weftFreq: findTopFreq(weftFreqSpectrum, 2, 5),
            _rows: M,
            _cols: N,
            _warpSpectrum: warpFreqSpectrum,
            _weftSpectrum: weftFreqSpectrum
        };
    };

    FabricAnalysis.drawFFTSpectrum = function (canvasId, fftResult) {
        var canvas = getCanvas(canvasId);
        if (!canvas || !fftResult) return;

        var rect = canvas.getBoundingClientRect();
        var ctx = getCtx(canvas);
        var W = rect.width;
        var H = rect.height;

        ctx.clearRect(0, 0, W, H);

        var M = fftResult._rows || 64;
        var N = fftResult._cols || 64;
        var spectrum = fftResult.spectrum2D;

        var leftPlot = 80;
        var rightPlot = 80;
        var topPad = 25;
        var botPad = 70;
        var heatW = W - leftPlot - rightPlot;
        var heatH = H - topPad - botPad;

        if (heatW < 20 || heatH < 20) return;

        var cellW = heatW / N;
        var cellH = heatH / M;

        var maxVal = 0;
        for (var i = 0; i < spectrum.length; i++) {
            if (spectrum[i] > maxVal) maxVal = spectrum[i];
        }
        if (maxVal === 0) maxVal = 1;

        function pseudoColor(normalized) {
            normalized = Math.max(0, Math.min(1, normalized));
            var r, g, b;
            if (normalized < 0.25) {
                var t = normalized / 0.25;
                r = 0;
                g = Math.floor(t * 255);
                b = 255;
            } else if (normalized < 0.5) {
                var t2 = (normalized - 0.25) / 0.25;
                r = 0;
                g = 255;
                b = Math.floor(255 * (1 - t2));
            } else if (normalized < 0.75) {
                var t3 = (normalized - 0.5) / 0.25;
                r = Math.floor(255 * t3);
                g = 255;
                b = 0;
            } else {
                var t4 = (normalized - 0.75) / 0.25;
                r = 255;
                g = Math.floor(255 * (1 - t4));
                b = 0;
            }
            return 'rgb(' + r + ',' + g + ',' + b + ')';
        }

        for (var y = 0; y < M; y++) {
            for (var x = 0; x < N; x++) {
                var v = spectrum[y * N + x];
                var norm = v / maxVal;
                norm = Math.pow(norm, 0.5);
                ctx.fillStyle = pseudoColor(norm);
                ctx.fillRect(leftPlot + x * cellW, topPad + y * cellH, Math.ceil(cellW), Math.ceil(cellH));
            }
        }

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftPlot, topPad, heatW, heatH);

        var warpSpec = fftResult._warpSpectrum;
        if (warpSpec) {
            var maxWS = 0;
            for (var wi = 0; wi < warpSpec.length; wi++) {
                if (warpSpec[wi] > maxWS) maxWS = warpSpec[wi];
            }
            if (maxWS === 0) maxWS = 1;

            ctx.strokeStyle = '#1a5490';
            ctx.fillStyle = 'rgba(26, 84, 144, 0.15)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (var wk = 0; wk < Math.min(M, warpSpec.length); wk++) {
                var hx = leftPlot - 2 - (warpSpec[wk] / maxWS) * (leftPlot - 15);
                var hy = topPad + wk * cellH + cellH / 2;
                if (wk === 0) ctx.moveTo(leftPlot - 2, hy);
                ctx.lineTo(hx, hy);
            }
            ctx.lineTo(leftPlot - 2, topPad + heatH);
            ctx.lineTo(leftPlot - 2, topPad);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#1a5490';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.save();
            ctx.translate(18, topPad + heatH / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('经向频谱', 0, 0);
            ctx.restore();
        }

        var weftSpec = fftResult._weftSpectrum;
        if (weftSpec) {
            var maxFS = 0;
            for (var fi = 0; fi < weftSpec.length; fi++) {
                if (weftSpec[fi] > maxFS) maxFS = weftSpec[fi];
            }
            if (maxFS === 0) maxFS = 1;

            ctx.strokeStyle = '#c0392b';
            ctx.fillStyle = 'rgba(192, 57, 43, 0.15)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (var fk = 0; fk < Math.min(N, weftSpec.length); fk++) {
                var fx = leftPlot + fk * cellW + cellW / 2;
                var fy = topPad + heatH + 2 + (weftSpec[fk] / maxFS) * (botPad - 25);
                if (fk === 0) ctx.moveTo(fx, topPad + heatH + 2);
                ctx.lineTo(fx, fy);
            }
            ctx.lineTo(leftPlot + heatW, topPad + heatH + 2);
            ctx.lineTo(leftPlot, topPad + heatH + 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#c0392b';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('纬向频谱', leftPlot + heatW / 2, H - 25);
        }

        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('二维FFT频谱热力图 (伪彩色: 低蓝→高红)', W / 2, 15);

        var warpTop = fftResult.warpFreq || [];
        var weftTop = fftResult.weftFreq || [];
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#555';
        ctx.fillText('经向主频: ' + warpTop.join(', ') + '  纬向主频: ' + weftTop.join(', '), leftPlot, H - 5);
    };

    FabricAnalysis.drawTextureImage = function (canvasId, matrix, scale) {
        var canvas = getCanvas(canvasId);
        if (!canvas || !matrix) return;

        scale = scale || 4;
        var rect = canvas.getBoundingClientRect();
        var ctx = getCtx(canvas);
        var W = rect.width;
        var H = rect.height;

        ctx.clearRect(0, 0, W, H);

        var warpCount = matrix.length;
        var weftCount = warpCount > 0 ? matrix[0].length : 0;
        if (warpCount === 0 || weftCount === 0) return;

        var imgW = warpCount * scale;
        var imgH = weftCount * scale;
        var offX = Math.max(0, (W - imgW) / 2);
        var offY = Math.max(0, (H - imgH) / 2);

        var colorWarp = '#e8d4a8';
        var colorWeft = '#5d3a1a';

        function hexToRgb(hex) {
            var r = parseInt(hex.slice(1, 3), 16);
            var g = parseInt(hex.slice(3, 5), 16);
            var b = parseInt(hex.slice(5, 7), 16);
            return { r: r, g: g, b: b };
        }

        function rgbToStr(r, g, b) {
            return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
        }

        function applyShade(rgb, shade) {
            return {
                r: Math.max(0, Math.min(255, rgb.r + shade)),
                g: Math.max(0, Math.min(255, rgb.g + shade)),
                b: Math.max(0, Math.min(255, rgb.b + shade))
            };
        }

        var rgbWarp = hexToRgb(colorWarp);
        var rgbWeft = hexToRgb(colorWeft);

        for (var w = 0; w < warpCount; w++) {
            for (var f = 0; f < weftCount; f++) {
                var val = matrix[w][f];
                var baseColor = (val === 1) ? rgbWarp : rgbWeft;

                for (var sx = 0; sx < scale; sx++) {
                    for (var sy = 0; sy < scale; sy++) {
                        var dx = sx / scale;
                        var dy = sy / scale;
                        var lightAngle = (dx + dy) * 0.5;
                        var shade = Math.round((lightAngle - 0.5) * 60);

                        if (val === 1) {
                            var threadShape = Math.sin(dy * Math.PI);
                            shade += Math.round(threadShape * 15);
                        } else {
                            var threadShape2 = Math.sin(dx * Math.PI);
                            shade += Math.round(threadShape2 * 15);
                        }

                        var c = applyShade(baseColor, shade);
                        ctx.fillStyle = rgbToStr(c.r, c.g, c.b);
                        ctx.fillRect(offX + w * scale + sx, offY + f * scale + sy, 1, 1);
                    }
                }
            }
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(offX, offY, imgW, imgH);

        ctx.fillStyle = '#333';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(warpCount + '×' + weftCount + ' 组织 (缩放 ' + scale + '×)', offX, offY - 5);
    };

    FabricAnalysis.analyzePattern = function (matrix) {
        var result = {
            patternName: '未知组织',
            warpCycle: 0,
            weftCycle: 0,
            warpCoverage: 0
        };

        if (!matrix || matrix.length === 0) return result;

        var warpCount = Math.min(matrix.length, 64);
        var weftCount = Math.min(matrix[0].length, 64);

        if (warpCount < 2 || weftCount < 2) return result;

        function findCycle1D(arr, maxLen) {
            var len = Math.min(arr.length, maxLen);
            for (var cycle = 1; cycle <= len / 2; cycle++) {
                var match = true;
                for (var i = cycle; i < len; i++) {
                    if (arr[i] !== arr[i % cycle]) {
                        match = false;
                        break;
                    }
                }
                if (match) return cycle;
            }
            return len;
        }

        function columnToStr(colIdx) {
            var s = '';
            for (var r = 0; r < weftCount; r++) {
                s += matrix[colIdx][r];
            }
            return s;
        }

        function rowToStr(rowIdx) {
            var s = '';
            for (var c = 0; c < warpCount; c++) {
                s += matrix[c][rowIdx];
            }
            return s;
        }

        var colPatterns = [];
        for (var ci = 0; ci < warpCount; ci++) {
            colPatterns.push(columnToStr(ci));
        }

        var rowPatterns = [];
        for (var ri = 0; ri < weftCount; ri++) {
            rowPatterns.push(rowToStr(ri));
        }

        function findPatternCycle(patterns, maxLen) {
            var len = Math.min(patterns.length, maxLen);
            for (var cycle = 1; cycle <= Math.floor(len / 2); cycle++) {
                var ok = true;
                for (var i = cycle; i < len; i++) {
                    if (patterns[i] !== patterns[i % cycle]) {
                        ok = false;
                        break;
                    }
                }
                if (ok) return cycle;
            }
            return len;
        }

        var warpCycle = findPatternCycle(colPatterns, 64);
        var weftCycle = findPatternCycle(rowPatterns, 64);

        result.warpCycle = warpCycle;
        result.weftCycle = weftCycle;

        var warpFloatCount = 0;
        var totalCount = warpCycle * weftCycle;
        for (var wc = 0; wc < warpCycle; wc++) {
            for (var wf = 0; wf < weftCycle; wf++) {
                if (matrix[wc][wf] === 1) warpFloatCount++;
            }
        }
        result.warpCoverage = totalCount > 0 ? warpFloatCount / totalCount : 0;

        function isPlainWeave() {
            if (warpCycle !== 2 || weftCycle !== 2) return false;
            var m = [
                [matrix[0][0], matrix[0][1]],
                [matrix[1][0], matrix[1][1]]
            ];
            return (m[0][0] === 1 && m[0][1] === 0 && m[1][0] === 0 && m[1][1] === 1) ||
                   (m[0][0] === 0 && m[0][1] === 1 && m[1][0] === 1 && m[1][1] === 0);
        }

        function isTwill2x2() {
            if (warpCycle !== 4 || weftCycle !== 4) return false;
            var shifted = true;
            for (var c = 1; c < warpCycle; c++) {
                for (var r = 0; r < weftCycle; r++) {
                    var expected = matrix[c - 1][(r - 1 + weftCycle) % weftCycle];
                    if (matrix[c][r] !== expected) {
                        shifted = false;
                        break;
                    }
                }
                if (!shifted) break;
            }
            if (!shifted) return false;
            for (var cc = 0; cc < warpCycle; cc++) {
                var row0col = matrix[cc];
                var runs = [];
                var cur = row0col[0];
                var cnt = 1;
                for (var rr = 1; rr < weftCycle; rr++) {
                    if (row0col[rr] === cur) cnt++;
                    else {
                        runs.push({ val: cur, len: cnt });
                        cur = row0col[rr];
                        cnt = 1;
                    }
                }
                runs.push({ val: cur, len: cnt });
                for (var k = 0; k < runs.length; k++) {
                    if (runs[k].len !== 2) return false;
                }
            }
            return true;
        }

        function isSatin3x1() {
            if (warpCycle !== 4 || weftCycle !== 4) return false;
            var longFloat = 0;
            for (var c2 = 0; c2 < warpCycle; c2++) {
                var cnt1 = 0;
                for (var r2 = 0; r2 < weftCycle; r2++) {
                    if (matrix[c2][r2] === 1) cnt1++;
                }
                if (cnt1 === 3) longFloat++;
            }
            return longFloat >= 3;
        }

        if (isPlainWeave()) {
            result.patternName = '1/1平纹组织';
        } else if (isTwill2x2()) {
            result.patternName = '2/2斜纹组织';
        } else if (isSatin3x1()) {
            result.patternName = '3/1缎纹组织';
        } else if (warpCycle <= 16 && weftCycle <= 16) {
            result.patternName = '小花纹组织 (循环:' + warpCycle + '×' + weftCycle + ')';
        } else {
            result.patternName = '云锦大花组织';
        }

        return result;
    };

    window.FabricAnalysis = FabricAnalysis;

})(window);
