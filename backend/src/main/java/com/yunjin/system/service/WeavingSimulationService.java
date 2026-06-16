package com.yunjin.system.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yunjin.system.entity.Loom;
import com.yunjin.system.entity.WeavingSimulation;
import com.yunjin.system.repository.LoomRepository;
import com.yunjin.system.repository.WeavingSimulationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class WeavingSimulationService {

    private final WeavingSimulationRepository weavingSimulationRepository;
    private final LoomRepository loomRepository;
    private final ObjectMapper objectMapper;

    private static final int INITIAL_WEFT_ROWS = 500;
    private static final int MAX_WEFT_ROWS = 10000;

    private static final double COEFFICIENT_OF_FRICTION_MU = 0.28;
    private static final double WARP_SPACING_MM = 0.83;
    private static final double HEDDLE_EYE_FRICTION_MU = 0.15;
    private static final double REED_DENT_FRICTION_MU = 0.12;
    private static final double BACK_BEAM_WRAP_ANGLE_RAD = 1.57;

    @Value("${weaving.simulation.tension-base:2.2}")
    private double baseTensionNewtons;

    @Value("${weaving.simulation.friction-coefficient:0.28}")
    private double configuredFrictionMu;

    @Autowired
    public WeavingSimulationService(WeavingSimulationRepository weavingSimulationRepository,
                                    LoomRepository loomRepository,
                                    ObjectMapper objectMapper) {
        this.weavingSimulationRepository = weavingSimulationRepository;
        this.loomRepository = loomRepository;
        this.objectMapper = objectMapper;
    }

    public WeavingSimulation initSimulation(Long loomId) {
        Optional<Loom> loomOpt = loomRepository.findById(loomId);
        if (loomOpt.isEmpty()) {
            throw new IllegalArgumentException("Loom not found with id: " + loomId);
        }

        Loom loom = loomOpt.get();
        int warpCount = loom.getTotalWarpCount() != null ? loom.getTotalWarpCount() : 1200;

        Optional<WeavingSimulation> existingOpt = weavingSimulationRepository.findByLoomId(loomId);
        WeavingSimulation simulation;
        if (existingOpt.isPresent()) {
            simulation = existingOpt.get();
        } else {
            simulation = new WeavingSimulation();
            simulation.setLoomId(loomId);
        }

        simulation.setCurrentWeftRow(0);

        int[][] interlacementMatrix = new int[warpCount][INITIAL_WEFT_ROWS];
        for (int i = 0; i < warpCount; i++) {
            for (int j = 0; j < INITIAL_WEFT_ROWS; j++) {
                interlacementMatrix[i][j] = -1;
            }
        }

        int[] initialShed = generateShedOpening(0, warpCount);

        try {
            simulation.setInterlacementMatrix(objectMapper.writeValueAsString(interlacementMatrix));
            simulation.setShedState(objectMapper.writeValueAsString(initialShed));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to initialize simulation data", e);
        }

        simulation.setLastUpdated(LocalDateTime.now());
        return weavingSimulationRepository.save(simulation);
    }

    public WeavingSimulation processWeftInsertion(Long loomId, int[] shedOpening) {
        Optional<WeavingSimulation> simOpt = weavingSimulationRepository.findByLoomId(loomId);
        if (simOpt.isEmpty()) {
            throw new IllegalStateException("Simulation not initialized for loom: " + loomId);
        }

        WeavingSimulation simulation = simOpt.get();
        int currentRow = simulation.getCurrentWeftRow();

        int[][] interlacementMatrix;
        try {
            interlacementMatrix = objectMapper.readValue(
                    simulation.getInterlacementMatrix(), int[][].class);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize interlacement matrix", e);
        }

        int warpCount = interlacementMatrix.length;
        if (shedOpening.length != warpCount) {
            throw new IllegalArgumentException(
                    String.format("Shed opening length (%d) does not match warp count (%d)",
                            shedOpening.length, warpCount));
        }

        if (currentRow >= interlacementMatrix[0].length) {
            interlacementMatrix = expandMatrix(interlacementMatrix);
        }

        for (int warp = 0; warp < warpCount; warp++) {
            if (shedOpening[warp] == 1) {
                interlacementMatrix[warp][currentRow] = 1;
            } else {
                interlacementMatrix[warp][currentRow] = 0;
            }
        }

        currentRow++;
        simulation.setCurrentWeftRow(currentRow);

        try {
            simulation.setInterlacementMatrix(objectMapper.writeValueAsString(interlacementMatrix));
            simulation.setShedState(objectMapper.writeValueAsString(shedOpening));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize simulation state", e);
        }

        simulation.setLastUpdated(LocalDateTime.now());
        return weavingSimulationRepository.save(simulation);
    }

    public double[] computeWarpTensionWithFriction(Long loomId, double baseTension, int[] shedArray) {
        Optional<Loom> loomOpt = loomRepository.findById(loomId);
        int warpCount = shedArray.length;
        int borderCount = Math.min(100, warpCount / 12);

        double mu = configuredFrictionMu > 0 ? configuredFrictionMu : COEFFICIENT_OF_FRICTION_MU;
        double[] tensions = new double[warpCount];

        for (int w = 0; w < warpCount; w++) {
            double normalizedPos = (double) w / (warpCount - 1);

            double positionFactor = 1.0 + 0.08 * Math.sin(2 * Math.PI * normalizedPos * 3)
                    + 0.04 * Math.cos(2 * Math.PI * normalizedPos * 7);

            double borderFactor = 1.0;
            if (w < borderCount) {
                double borderRatio = (double) w / borderCount;
                borderFactor = 1.0 + 0.18 * (1.0 - borderRatio);
            } else if (w >= warpCount - borderCount) {
                double borderRatio = (double) (warpCount - 1 - w) / borderCount;
                borderFactor = 1.0 + 0.18 * (1.0 - borderRatio);
            }

            double shedFactor;
            if (shedArray != null && w < shedArray.length) {
                shedFactor = (shedArray[w] == 1) ? 1.12 : 0.90;
            } else {
                shedFactor = 1.0;
            }

            double cumulativeWear = 1.0 + 0.06 * Math.log1p(warpCount - w);

            double capstanFactor = Math.exp(mu * BACK_BEAM_WRAP_ANGLE_RAD * (0.8 + 0.4 * normalizedPos));
            double heddleReedFactor = 1.0 + HEDDLE_EYE_FRICTION_MU * 0.25 + REED_DENT_FRICTION_MU * 0.15;

            double randomNoise = 1.0 + (Math.random() - 0.5) * 0.08;

            tensions[w] = baseTension * positionFactor * borderFactor
                    * shedFactor * cumulativeWear * capstanFactor * heddleReedFactor * randomNoise;

            tensions[w] = Math.max(0.01, Math.min(6.5, tensions[w]));
        }

        return tensions;
    }

    public double[] computeWarpTensionWithFriction(int warpCount, double baseTension) {
        return computeWarpTensionWithFriction(null, baseTension, new int[warpCount]);
    }

    public Map<String, Object> getTensionModelParameters() {
        Map<String, Object> params = new HashMap<>();
        params.put("coefficientOfFrictionMu", configuredFrictionMu > 0 ? configuredFrictionMu : COEFFICIENT_OF_FRICTION_MU);
        params.put("backBeamWrapAngleRad", BACK_BEAM_WRAP_ANGLE_RAD);
        params.put("heddleEyeFrictionMu", HEDDLE_EYE_FRICTION_MU);
        params.put("reedDentFrictionMu", REED_DENT_FRICTION_MU);
        params.put("warpSpacingMm", WARP_SPACING_MM);
        params.put("baseTensionNewtons", baseTensionNewtons);
        params.put("borderEnhancement", "+18% 两侧边经");
        params.put("shedEnhancement", "+12% 上层经纱 / -10% 下层经纱");
        return params;
    }

    public Map<String, Object> getSimulationState(Long loomId) {
        Optional<WeavingSimulation> simOpt = weavingSimulationRepository.findByLoomId(loomId);
        if (simOpt.isEmpty()) {
            throw new IllegalStateException("Simulation not initialized for loom: " + loomId);
        }

        WeavingSimulation simulation = simOpt.get();
        Map<String, Object> state = new HashMap<>();
        state.put("loomId", simulation.getLoomId());
        state.put("currentWeftRow", simulation.getCurrentWeftRow());
        state.put("lastUpdated", simulation.getLastUpdated());

        try {
            int[][] matrix = objectMapper.readValue(
                    simulation.getInterlacementMatrix(), int[][].class);
            int[][] trimmedMatrix = trimMatrix(matrix, simulation.getCurrentWeftRow());
            state.put("interlacementMatrix", trimmedMatrix);
            state.put("warpCount", matrix.length);
            state.put("filledWeftCount", simulation.getCurrentWeftRow());

            int[] shedState = objectMapper.readValue(simulation.getShedState(), int[].class);
            state.put("shedOpening", shedState);
            state.put("tensionModel", getTensionModelParameters());
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize simulation state", e);
        }

        return state;
    }

    public int[] generateShedOpening(int patternPos, int warpCount) {
        int[] shed = new int[warpCount];

        int harnesses = 4;
        for (int warp = 0; warp < warpCount; warp++) {
            int harnessGroup = warp % harnesses;
            int phase = (patternPos + harnessGroup) % harnesses;
            shed[warp] = (phase == 0 || phase == 2) ? 1 : 0;
        }

        int patternCycle = 24;
        int patternOffset = patternPos % patternCycle;
        for (int warp = 0; warp < warpCount; warp++) {
            int warpPatternPos = (warp + patternOffset) % patternCycle;
            if (warpPatternPos >= 12 && warpPatternPos < 18) {
                shed[warp] = 1;
            } else if (warpPatternPos >= 6 && warpPatternPos < 9) {
                shed[warp] = 0;
            }
        }

        int motifAreaStart = Math.max(0, warpCount / 4);
        int motifAreaEnd = Math.min(warpCount, 3 * warpCount / 4);
        for (int warp = motifAreaStart; warp < motifAreaEnd; warp++) {
            int motifPos = (warp - motifAreaStart + patternOffset) % 16;
            if (motifPos == 2 || motifPos == 5 || motifPos == 10 || motifPos == 13) {
                shed[warp] = 1;
            }
        }

        int borderWidth = Math.min(100, warpCount / 12);
        for (int warp = 0; warp < borderWidth && warp < warpCount; warp++) {
            int borderCycle = warp % 2;
            shed[warp] = ((patternPos + borderCycle) % 2 == 0) ? 1 : 0;
        }
        for (int warp = Math.max(0, warpCount - borderWidth); warp < warpCount; warp++) {
            int borderCycle = (warpCount - 1 - warp) % 2;
            shed[warp] = ((patternPos + borderCycle) % 2 == 0) ? 1 : 0;
        }

        return shed;
    }

    private int[][] expandMatrix(int[][] original) {
        int warpCount = original.length;
        int oldWeftCount = original[0].length;
        int newWeftCount = Math.min(oldWeftCount * 2, MAX_WEFT_ROWS);

        if (newWeftCount <= oldWeftCount) {
            return original;
        }

        int[][] expanded = new int[warpCount][newWeftCount];
        for (int i = 0; i < warpCount; i++) {
            System.arraycopy(original[i], 0, expanded[i], 0, oldWeftCount);
            for (int j = oldWeftCount; j < newWeftCount; j++) {
                expanded[i][j] = -1;
            }
        }
        return expanded;
    }

    private int[][] trimMatrix(int[][] matrix, int filledRows) {
        if (filledRows <= 0) {
            return new int[matrix.length][0];
        }
        int warpCount = matrix.length;
        int displayRows = Math.min(filledRows, 200);
        int startRow = Math.max(0, filledRows - displayRows);

        int[][] trimmed = new int[warpCount][displayRows];
        for (int warp = 0; warp < warpCount; warp++) {
            for (int weft = 0; weft < displayRows; weft++) {
                trimmed[warp][weft] = matrix[warp][startRow + weft];
            }
        }
        return trimmed;
    }
}
