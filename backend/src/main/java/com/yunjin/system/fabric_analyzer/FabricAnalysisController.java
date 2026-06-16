package com.yunjin.system.fabric_analyzer;

import com.yunjin.system.entity.FabricAnalysis;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/analysis")
@CrossOrigin(origins = "*", maxAge = 3600)
public class FabricAnalysisController {

    private final FabricAnalyzerService analysisService;

    public FabricAnalysisController(FabricAnalyzerService analysisService) {
        this.analysisService = analysisService;
    }

    @PostMapping("/analyze/{loomId}")
    public ResponseEntity<Map<String, Object>> analyze(@PathVariable Long loomId) {
        try {
            FabricAnalysis analysis = analysisService.analyzeFabricStructure(loomId);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", analysis);
            result.put("message", "织物分析完成");
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (RuntimeException e) {
            Map<String, Object> notFound = new HashMap<>();
            notFound.put("success", false);
            notFound.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "织物分析失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/loom/{loomId}")
    public ResponseEntity<Map<String, Object>> getHistory(@PathVariable Long loomId) {
        try {
            List<FabricAnalysis> list = analysisService.getAnalysisHistory(loomId);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", list);
            result.put("count", list.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取分析历史失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable Long id) {
        try {
            Optional<FabricAnalysis> opt = analysisService.getAnalysisById(id);
            if (opt.isPresent()) {
                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("data", opt.get());
                return ResponseEntity.ok(result);
            } else {
                Map<String, Object> notFound = new HashMap<>();
                notFound.put("success", false);
                notFound.put("message", "分析记录不存在: " + id);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取分析详情失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
