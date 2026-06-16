package com.yunjin.system.fabric_analyzer;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yunjin.system.entity.FabricAnalysis;
import com.yunjin.system.entity.WeavingSimulation;
import com.yunjin.system.repository.FabricAnalysisRepository;
import com.yunjin.system.repository.WeavingSimulationRepository;
import org.apache.commons.math3.complex.Complex;
import org.apache.commons.math3.transform.DftNormalization;
import org.apache.commons.math3.transform.FastFourierTransformer;
import org.apache.commons.math3.transform.TransformType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class FabricAnalyzerService {

    private final FabricAnalysisRepository fabricAnalysisRepository;
    private final WeavingSimulationRepository weavingSimulationRepository;
    private final ObjectMapper objectMapper;

    private final FastFourierTransformer fftTransformer =
            new FastFourierTransformer(DftNormalization.STANDARD);

    @Autowired
    public FabricAnalyzerService(FabricAnalysisRepository fabricAnalysisRepository,
                                 WeavingSimulationRepository weavingSimulationRepository,
                                 ObjectMapper objectMapper) {
        this.fabricAnalysisRepository = fabricAnalysisRepository;
        this.weavingSimulationRepository = weavingSimulationRepository;
        this.objectMapper = objectMapper;
    }

    public FabricAnalysis analyzeFabricStructure(Long loomId) {
        Optional<WeavingSimulation> simOpt = weavingSimulationRepository.findByLoomId(loomId);
        if (simOpt.isEmpty()) {
            throw new IllegalStateException("Weaving simulation not found for loom: " + loomId);
        }

        WeavingSimulation simulation = simOpt.get();
        int[][] matrix;
        try {
            matrix = objectMapper.readValue(simulation.getInterlacementMatrix(), int[][].class);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize interlacement matrix", e);
        }

        int filledRows = simulation.getCurrentWeftRow();
        if (filledRows < 8) {
            throw new IllegalStateException("Insufficient weft rows for analysis. Need at least 8, got: " + filledRows);
        }

        int[][] activeMatrix = extractActiveMatrix(matrix, filledRows);

        Map<String, Object> patternResult = identifyWeavePattern(activeMatrix);
        Map<String, Object> fftResult = performFFTAnalysis(activeMatrix);
        Map<String, Object> waveletResult = haarWaveletAnalyze(activeMatrix);
        int[][] textureData = generateTextureImage(activeMatrix);

        FabricAnalysis analysis = new FabricAnalysis();
        analysis.setLoomId(loomId);
        analysis.setAnalysisType("FULL_STRUCTURE");
        analysis.setWeavePattern((String) patternResult.get("pattern"));
        analysis.setWarpCount(activeMatrix.length);
        analysis.setWeftCount(activeMatrix[0].length);

        Map<String, Object> waveletInfo = new HashMap<>();
        waveletInfo.put("description", "本分析还含多分辨率小波分析");
        waveletInfo.put("waveletType", "Haar");
        waveletInfo.put("levels", 4);
        fftResult.put("waveletInfo", waveletInfo);

        Map<String, Object> resultJson = new HashMap<>();
        resultJson.put("patternInfo", patternResult);
        resultJson.put("fftAnalysis", fftResult);
        resultJson.put("waveletAnalysis", waveletResult);
        resultJson.put("statistics", calculateStatistics(activeMatrix));

        try {
            analysis.setTextureData(objectMapper.writeValueAsString(textureData));
            analysis.setFftSpectrum(objectMapper.writeValueAsString(fftResult));
            analysis.setResultJson(objectMapper.writeValueAsString(resultJson));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize analysis results", e);
        }

        return fabricAnalysisRepository.save(analysis);
    }

    public Map<String, Object> identifyWeavePattern(int[][] matrix) {
        Map<String, Object> result = new HashMap<>();
        int warpCount = matrix.length;
        int weftCount = matrix[0].length;

        int warpPeriod = detectPeriodWarp(matrix);
        int weftPeriod = detectPeriodWeft(matrix);

        int analysisWarp = Math.min(warpCount, 64);
        int analysisWeft = Math.min(weftCount, 64);
        int[][] sample = new int[analysisWarp][analysisWeft];
        for (int w = 0; w < analysisWarp; w++) {
            System.arraycopy(matrix[w], 0, sample[w], 0, analysisWeft);
        }

        String patternName;
        double confidence = 0.0;

        if (isPlainWeave(sample)) {
            patternName = "PLAIN_WEAVE";
            confidence = 0.95;
        } else if (isTwillWeave(sample)) {
            patternName = "TWILL_WEAVE";
            confidence = 0.9;
        } else if (isSatinWeave(sample)) {
            patternName = "SATIN_WEAVE";
            confidence = 0.85;
        } else {
            patternName = "YUNJIN_PATTERNED";
            confidence = calculatePatternedConfidence(sample);
        }

        result.put("pattern", patternName);
        result.put("confidence", confidence);
        result.put("warpPeriod", warpPeriod);
        result.put("weftPeriod", weftPeriod);
        result.put("analysisWarpSize", analysisWarp);
        result.put("analysisWeftSize", analysisWeft);

        return result;
    }

    public Map<String, Object> performFFTAnalysis(int[][] matrix) {
        Map<String, Object> result = new HashMap<>();
        int warpCount = matrix.length;
        int weftCount = matrix[0].length;

        int fftSizeWarp = nextPowerOfTwo(Math.min(warpCount, 512));
        int fftSizeWeft = nextPowerOfTwo(Math.min(weftCount, 512));

        double[] warpSamples = new double[fftSizeWarp];
        for (int w = 0; w < Math.min(warpCount, fftSizeWarp); w++) {
            double sum = 0.0;
            for (int s = 0; s < weftCount; s++) {
                sum += matrix[w][s];
            }
            warpSamples[w] = sum / weftCount;
        }
        for (int w = warpCount; w < fftSizeWarp; w++) {
            warpSamples[w] = 0.0;
        }

        Complex[] warpFFT = fftTransformer.transform(warpSamples, TransformType.FORWARD);
        double[] warpAmplitude = new double[fftSizeWarp / 2];
        double warpMaxAmp = 0;
        int warpDominantFreq = 0;
        for (int k = 0; k < fftSizeWarp / 2; k++) {
            warpAmplitude[k] = warpFFT[k].abs();
            if (k > 0 && warpAmplitude[k] > warpMaxAmp) {
                warpMaxAmp = warpAmplitude[k];
                warpDominantFreq = k;
            }
        }

        double[] weftSamples = new double[fftSizeWeft];
        for (int s = 0; s < Math.min(weftCount, fftSizeWeft); s++) {
            double sum = 0.0;
            for (int w = 0; w < warpCount; w++) {
                sum += matrix[w][s];
            }
            weftSamples[s] = sum / warpCount;
        }
        for (int s = weftCount; s < fftSizeWeft; s++) {
            weftSamples[s] = 0.0;
        }

        Complex[] weftFFT = fftTransformer.transform(weftSamples, TransformType.FORWARD);
        double[] weftAmplitude = new double[fftSizeWeft / 2];
        double weftMaxAmp = 0;
        int weftDominantFreq = 0;
        for (int k = 0; k < fftSizeWeft / 2; k++) {
            weftAmplitude[k] = weftFFT[k].abs();
            if (k > 0 && weftAmplitude[k] > weftMaxAmp) {
                weftMaxAmp = weftAmplitude[k];
                weftDominantFreq = k;
            }
        }

        Map<String, Object> warpSpec = new HashMap<>();
        warpSpec.put("amplitudeSpectrum", warpAmplitude);
        warpSpec.put("dominantFrequencyIndex", warpDominantFreq);
        warpSpec.put("dominantAmplitude", warpMaxAmp);
        warpSpec.put("estimatedPeriod", warpDominantFreq > 0 ? (double) fftSizeWarp / warpDominantFreq : 0);

        Map<String, Object> weftSpec = new HashMap<>();
        weftSpec.put("amplitudeSpectrum", weftAmplitude);
        weftSpec.put("dominantFrequencyIndex", weftDominantFreq);
        weftSpec.put("dominantAmplitude", weftMaxAmp);
        weftSpec.put("estimatedPeriod", weftDominantFreq > 0 ? (double) fftSizeWeft / weftDominantFreq : 0);

        result.put("warpDirection", warpSpec);
        result.put("weftDirection", weftSpec);
        result.put("fftSizeWarp", fftSizeWarp);
        result.put("fftSizeWeft", fftSizeWeft);

        return result;
    }

    public int[][] generateTextureImage(int[][] matrix) {
        int warpCount = matrix.length;
        int weftCount = matrix[0].length;

        int displayWarp = Math.min(warpCount, 256);
        int displayWeft = Math.min(weftCount, 256);

        int warpStep = (int) Math.ceil((double) warpCount / displayWarp);
        int weftStep = (int) Math.ceil((double) weftCount / displayWeft);

        int[][] texture = new int[displayWarp][displayWeft];

        for (int dw = 0; dw < displayWarp; dw++) {
            for (int ds = 0; ds < displayWeft; ds++) {
                int sw = dw * warpStep;
                int ss = ds * weftStep;

                if (sw < warpCount && ss < weftCount) {
                    int val = matrix[sw][ss];
                    if (val == 1) {
                        texture[dw][ds] = 0xE8D4A8;
                    } else if (val == 0) {
                        texture[dw][ds] = 0x8B4513;
                    } else {
                        texture[dw][ds] = 0xE0E0E0;
                    }
                } else {
                    texture[dw][ds] = 0xF5F5F5;
                }
            }
        }

        return texture;
    }

    public FabricAnalysis saveAnalysis(FabricAnalysis analysis) {
        return fabricAnalysisRepository.save(analysis);
    }

    public List<FabricAnalysis> getAnalysisHistory(Long loomId) {
        return fabricAnalysisRepository.findByLoomIdOrderByCreatedAtDesc(loomId);
    }

    public Optional<FabricAnalysis> getAnalysisById(Long id) {
        return fabricAnalysisRepository.findById(id);
    }

    private int[][] extractActiveMatrix(int[][] matrix, int filledRows) {
        int warpCount = matrix.length;
        int weftCount = Math.min(filledRows, matrix[0].length);

        int[][] active = new int[warpCount][weftCount];
        for (int w = 0; w < warpCount; w++) {
            System.arraycopy(matrix[w], 0, active[w], 0, weftCount);
        }
        return active;
    }

    private int detectPeriodWarp(int[][] matrix) {
        int weftCount = matrix[0].length;
        int maxCheck = Math.min(matrix.length, 128);

        for (int period = 2; period <= maxCheck; period++) {
            boolean periodic = true;
            for (int w = period; w < maxCheck && periodic; w++) {
                for (int s = 0; s < Math.min(weftCount, 32); s++) {
                    if (matrix[w][s] != matrix[w - period][s]) {
                        periodic = false;
                        break;
                    }
                }
            }
            if (periodic) return period;
        }
        return -1;
    }

    private int detectPeriodWeft(int[][] matrix) {
        int warpCount = matrix.length;
        int maxCheck = Math.min(matrix[0].length, 128);

        for (int period = 2; period <= maxCheck; period++) {
            boolean periodic = true;
            for (int s = period; s < maxCheck && periodic; s++) {
                for (int w = 0; w < Math.min(warpCount, 32); w++) {
                    if (matrix[w][s] != matrix[w][s - period]) {
                        periodic = false;
                        break;
                    }
                }
            }
            if (periodic) return period;
        }
        return -1;
    }

    private boolean isPlainWeave(int[][] sample) {
        int w = sample.length;
        int s = sample[0].length;
        if (w < 4 || s < 4) return false;

        for (int i = 0; i < Math.min(w, 16); i++) {
            for (int j = 0; j < Math.min(s, 16); j++) {
                int expected = ((i + j) % 2 == 0) ? 1 : 0;
                if (sample[i][j] != expected) return false;
            }
        }
        return true;
    }

    private boolean isTwillWeave(int[][] sample) {
        int w = sample.length;
        int s = sample[0].length;
        if (w < 6 || s < 6) return false;

        boolean twill22 = true;
        for (int i = 0; i < Math.min(w, 16) && twill22; i++) {
            for (int j = 0; j < Math.min(s, 16) && twill22; j++) {
                int phase = (j - i + 4) % 4;
                int expected = (phase < 2) ? 1 : 0;
                if (sample[i][j] != expected) twill22 = false;
            }
        }
        if (twill22) return true;

        boolean twill31 = true;
        for (int i = 0; i < Math.min(w, 16) && twill31; i++) {
            for (int j = 0; j < Math.min(s, 16) && twill31; j++) {
                int phase = (j - i + 4) % 4;
                int expected = (phase < 3) ? 1 : 0;
                if (sample[i][j] != expected) twill31 = false;
            }
        }
        return twill31;
    }

    private boolean isSatinWeave(int[][] sample) {
        int w = sample.length;
        int s = sample[0].length;
        if (w < 8 || s < 8) return false;

        for (int move = 2; move <= 4; move++) {
            boolean satin = true;
            for (int i = 0; i < Math.min(w, 16) && satin; i++) {
                for (int j = 0; j < Math.min(s, 16) && satin; j++) {
                    int col = (i * move + j) % 5;
                    int expected = (col == 0) ? 1 : 0;
                    if (sample[i][j] != expected) satin = false;
                }
            }
            if (satin) return true;
        }
        return false;
    }

    private double calculatePatternedConfidence(int[][] sample) {
        int w = sample.length;
        int s = sample[0].length;

        int transitions = 0;
        for (int i = 0; i < w; i++) {
            for (int j = 0; j < s - 1; j++) {
                if (sample[i][j] != sample[i][j + 1]) transitions++;
            }
        }

        double density = (double) transitions / (w * s);
        if (density > 0.25) return 0.9;
        if (density > 0.15) return 0.75;
        if (density > 0.05) return 0.6;
        return 0.5;
    }

    private Map<String, Object> calculateStatistics(int[][] matrix) {
        Map<String, Object> stats = new HashMap<>();
        int warpCount = matrix.length;
        int weftCount = matrix[0].length;

        long warpFloats = 0;
        long weftFloats = 0;
        long unprocessed = 0;

        for (int w = 0; w < warpCount; w++) {
            for (int s = 0; s < weftCount; s++) {
                int val = matrix[w][s];
                if (val == 1) warpFloats++;
                else if (val == 0) weftFloats++;
                else unprocessed++;
            }
        }

        long total = warpFloats + weftFloats;
        double warpRatio = total > 0 ? (double) warpFloats / total : 0;

        stats.put("warpFloatCount", warpFloats);
        stats.put("weftFloatCount", weftFloats);
        stats.put("unprocessedCount", unprocessed);
        stats.put("warpFloatRatio", warpRatio);
        stats.put("weftFloatRatio", 1.0 - warpRatio);

        return stats;
    }

    private int nextPowerOfTwo(int n) {
        int power = 1;
        while (power < n) {
            power <<= 1;
        }
        return power;
    }

    private double[] haarWaveletDecompose1D(double[] signal, int levels) {
        int origLen = signal.length;
        int paddedLen = nextPowerOfTwo(origLen);
        double[] padded = new double[paddedLen];
        System.arraycopy(signal, 0, padded, 0, origLen);
        for (int i = origLen; i < paddedLen; i++) {
            padded[i] = 0.0;
        }

        int maxLevels = (int) (Math.log(paddedLen) / Math.log(2));
        int actualLevels = Math.min(levels, maxLevels);

        double[] work = padded.clone();
        int len = paddedLen;

        for (int level = 0; level < actualLevels; level++) {
            if (len < 2) break;
            double[] approx = new double[len / 2];
            double[] detail = new double[len / 2];
            for (int i = 0; i < len / 2; i++) {
                double a = work[2 * i];
                double b = work[2 * i + 1];
                approx[i] = (a + b) / 2.0;
                detail[i] = (a - b) / 2.0;
            }
            System.arraycopy(approx, 0, work, 0, len / 2);
            System.arraycopy(detail, 0, work, len / 2, len / 2);
            len /= 2;
        }

        double[] result = new double[origLen];
        int copyLen = Math.min(work.length, origLen);
        System.arraycopy(work, 0, result, 0, copyLen);
        return result;
    }

    private Map<String, Object> haarWaveletAnalyze(int[][] matrix) {
        int warpCount = matrix.length;
        int weftCount = matrix[0].length;

        double[] warpSignal = new double[warpCount];
        for (int w = 0; w < warpCount; w++) {
            double sum = 0.0;
            for (int s = 0; s < weftCount; s++) {
                sum += matrix[w][s];
            }
            warpSignal[w] = sum / weftCount;
        }

        double[] weftSignal = new double[weftCount];
        for (int s = 0; s < weftCount; s++) {
            double sum = 0.0;
            for (int w = 0; w < warpCount; w++) {
                sum += matrix[w][s];
            }
            weftSignal[s] = sum / warpCount;
        }

        Map<String, Object> warpDecomp = buildWaveletDecomposition(warpSignal, 4);
        Map<String, Object> weftDecomp = buildWaveletDecomposition(weftSignal, 4);

        Map<String, Object> multiResFreq = new HashMap<>();
        java.util.List<Double> estimatedPeriods = new ArrayList<>();
        for (int level = 1; level <= 4; level++) {
            estimatedPeriods.add(Math.pow(2, level));
        }
        multiResFreq.put("estimatedPeriodsByLevel", estimatedPeriods);

        Map<String, Object> result = new HashMap<>();
        result.put("warpDecomposition", warpDecomp);
        result.put("weftDecomposition", weftDecomp);
        result.put("multiResolutionFrequencies", multiResFreq);

        return result;
    }

    private Map<String, Object> buildWaveletDecomposition(double[] signal, int maxLevels) {
        int paddedLen = nextPowerOfTwo(signal.length);
        int actualMaxLevels = (int) (Math.log(paddedLen) / Math.log(2));
        int levels = Math.min(maxLevels, actualMaxLevels);

        double[] fullDecomp = haarWaveletDecompose1D(signal, levels);

        double[] padded = new double[paddedLen];
        System.arraycopy(signal, 0, padded, 0, signal.length);

        double[][] detailByLevel = new double[levels][];
        int currentLen = paddedLen;
        double[] work = padded.clone();

        for (int level = 0; level < levels; level++) {
            if (currentLen < 2) break;
            double[] approx = new double[currentLen / 2];
            double[] detail = new double[currentLen / 2];
            for (int i = 0; i < currentLen / 2; i++) {
                double a = work[2 * i];
                double b = work[2 * i + 1];
                approx[i] = (a + b) / 2.0;
                detail[i] = (a - b) / 2.0;
            }
            detailByLevel[levels - 1 - level] = detail;
            System.arraycopy(approx, 0, work, 0, currentLen / 2);
            currentLen /= 2;
        }

        double[] approximation = new double[currentLen];
        System.arraycopy(work, 0, approximation, 0, currentLen);

        java.util.List<int[]> significantEdges = new ArrayList<>();
        for (int i = 0; i < levels; i++) {
            double[] detail = detailByLevel[i];
            if (detail == null || detail.length == 0) {
                significantEdges.add(new int[0]);
                continue;
            }
            double mean = 0.0;
            for (double v : detail) mean += Math.abs(v);
            mean /= detail.length;

            double variance = 0.0;
            for (double v : detail) {
                double diff = Math.abs(v) - mean;
                variance += diff * diff;
            }
            variance /= detail.length;
            double std = Math.sqrt(variance);
            double threshold = mean + 2.0 * std;

            java.util.List<Integer> sigIdx = new ArrayList<>();
            for (int j = 0; j < detail.length; j++) {
                if (Math.abs(detail[j]) > threshold) {
                    sigIdx.add(j);
                }
            }
            int[] arr = new int[sigIdx.size()];
            for (int k = 0; k < sigIdx.size(); k++) arr[k] = sigIdx.get(k);
            significantEdges.add(arr);
        }

        java.util.List<double[]> detailsList = new ArrayList<>();
        for (int i = 0; i < levels; i++) {
            detailsList.add(detailByLevel[i]);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("levels", levels);
        result.put("approximation", approximation);
        result.put("details", detailsList);
        result.put("significantEdges", significantEdges);

        return result;
    }
}
