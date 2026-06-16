package com.yunjin.system.weaving_simulator;

import com.yunjin.system.entity.WeavingSimulation;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/simulation")
@CrossOrigin(origins = "*", maxAge = 3600)
public class SimulationController {

    private final WeavingSimulatorService simulationService;

    public SimulationController(WeavingSimulatorService simulationService) {
        this.simulationService = simulationService;
    }

    @PostMapping("/init/{loomId}")
    public ResponseEntity<Map<String, Object>> init(@PathVariable Long loomId) {
        try {
            WeavingSimulation sim = simulationService.initSimulation(loomId);
            Map<String, Object> state = simulationService.getSimulationState(loomId);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", state);
            result.put("message", "仿真初始化成功");
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            Map<String, Object> notFound = new HashMap<>();
            notFound.put("success", false);
            notFound.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "初始化仿真失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/step/{loomId}")
    public ResponseEntity<Map<String, Object>> step(
            @PathVariable Long loomId,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            int[] shedOpening;
            if (body != null && body.containsKey("shedOpening")) {
                Object shedObj = body.get("shedOpening");
                if (shedObj instanceof java.util.List) {
                    @SuppressWarnings("unchecked")
                    java.util.List<Number> list = (java.util.List<Number>) shedObj;
                    shedOpening = list.stream().mapToInt(Number::intValue).toArray();
                } else {
                    throw new IllegalArgumentException("shedOpening格式不正确");
                }
            } else if (body != null && body.containsKey("patternPosition")) {
                int patternPosition = ((Number) body.get("patternPosition")).intValue();
                int warpCount = 120;
                try {
                    simulationService.initSimulation(loomId);
                } catch (Exception ignored) {}
                try {
                    Map<String, Object> current = simulationService.getSimulationState(loomId);
                    if (current.containsKey("warpCount")) {
                        warpCount = ((Number) current.get("warpCount")).intValue();
                    }
                } catch (Exception ignored) {}
                shedOpening = simulationService.generateShedOpening(patternPosition, warpCount);
            } else {
                shedOpening = simulationService.generateShedOpening(1, 120);
            }

            WeavingSimulation sim = simulationService.processWeftInsertion(loomId, shedOpening);
            Map<String, Object> state = simulationService.getSimulationState(loomId);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", state);
            result.put("message", "织造前进一步,当前纬纱行: " + sim.getCurrentWeftRow());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            Map<String, Object> bad = new HashMap<>();
            bad.put("success", false);
            bad.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(bad);
        } catch (RuntimeException e) {
            Map<String, Object> notFound = new HashMap<>();
            notFound.put("success", false);
            notFound.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "仿真步进失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/state/{loomId}")
    public ResponseEntity<Map<String, Object>> getState(@PathVariable Long loomId) {
        try {
            Map<String, Object> state = simulationService.getSimulationState(loomId);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", state);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            Map<String, Object> notFound = new HashMap<>();
            notFound.put("success", false);
            notFound.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取仿真状态失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/render/{loomId}")
    public ResponseEntity<Map<String, Object>> getRenderData(@PathVariable Long loomId) {
        try {
            Map<String, Object> state = simulationService.getSimulationState(loomId);
            Map<String, Object> renderData = new HashMap<>();
            renderData.put("interlacementMatrix", state.get("interlacementMatrix"));
            renderData.put("shedOpening", state.get("shedOpening"));
            renderData.put("currentWeftRow", state.get("currentWeftRow"));
            renderData.put("warpCount", state.get("warpCount"));
            renderData.put("filledWeftCount", state.get("filledWeftCount"));

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", renderData);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            Map<String, Object> notFound = new HashMap<>();
            notFound.put("success", false);
            notFound.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取渲染数据失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/tension-model")
    public ResponseEntity<Map<String, Object>> getTensionModelParams() {
        try {
            Map<String, Object> params = simulationService.getTensionModelParameters();
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", params);
            result.put("description", "经纱摩擦修正模型 - 包含绞盘公式/综眼摩擦/筘齿摩擦/边经增强/开口分层等8项因子");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取张力模型参数失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/compute-tension/{loomId}")
    public ResponseEntity<Map<String, Object>> computeTension(
            @PathVariable Long loomId,
            @RequestBody Map<String, Object> body) {
        try {
            double baseTension = 2.2;
            if (body.containsKey("baseTension")) {
                baseTension = ((Number) body.get("baseTension")).doubleValue();
            }

            int warpCount = 120;
            if (body.containsKey("warpCount")) {
                warpCount = ((Number) body.get("warpCount")).intValue();
            }

            int[] shedArray = null;
            if (body.containsKey("shedOpening")) {
                Object shedObj = body.get("shedOpening");
                if (shedObj instanceof java.util.List) {
                    @SuppressWarnings("unchecked")
                    java.util.List<Number> list = (java.util.List<Number>) shedObj;
                    shedArray = list.stream().mapToInt(Number::intValue).toArray();
                    warpCount = shedArray.length;
                }
            }

            if (shedArray == null) {
                shedArray = simulationService.generateShedOpening(1, warpCount);
            }

            double[] tensions = simulationService.computeWarpTensionWithFriction(loomId, baseTension, shedArray);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            Map<String, Object> data = new HashMap<>();
            data.put("warpCount", tensions.length);
            data.put("baseTension", baseTension);
            data.put("warpTensions", tensions);
            double avg = 0;
            int count = 0;
            double min = Double.MAX_VALUE;
            double max = 0;
            for (double t : tensions) {
                if (t > 0.1) {
                    avg += t; count++;
                    min = Math.min(min, t);
                    max = Math.max(max, t);
                }
            }
            avg = count > 0 ? avg / count : 0;
            data.put("averageTension", avg);
            data.put("minTension", min == Double.MAX_VALUE ? 0 : min);
            data.put("maxTension", max);
            data.put("tensionVariancePercent", count > 0 ? ((max - min) / avg * 100.0) : 0);
            result.put("data", data);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "计算张力分布失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
