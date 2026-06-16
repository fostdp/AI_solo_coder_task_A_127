package com.yunjin.system.controller;

import com.yunjin.system.entity.Loom;
import com.yunjin.system.repository.LoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/looms")
@CrossOrigin(origins = "*", maxAge = 3600)
public class LoomController {

    private final LoomRepository loomRepository;

    public LoomController(LoomRepository loomRepository) {
        this.loomRepository = loomRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll() {
        try {
            List<Loom> looms = loomRepository.findAll();
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", looms);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取织机列表失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable Long id) {
        try {
            return loomRepository.findById(id).map(loom -> {
                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("data", loom);
                return ResponseEntity.ok(result);
            }).orElseGet(() -> {
                Map<String, Object> notFound = new HashMap<>();
                notFound.put("success", false);
                notFound.put("message", "织机不存在: " + id);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
            });
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "获取织机信息失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody Loom loom) {
        try {
            if (loom.getLoomCode() == null || loom.getLoomName() == null) {
                Map<String, Object> bad = new HashMap<>();
                bad.put("success", false);
                bad.put("message", "织机编码和名称不能为空");
                return ResponseEntity.badRequest().body(bad);
            }
            if (loomRepository.findByLoomCode(loom.getLoomCode()).isPresent()) {
                Map<String, Object> conflict = new HashMap<>();
                conflict.put("success", false);
                conflict.put("message", "织机编码已存在: " + loom.getLoomCode());
                return ResponseEntity.status(HttpStatus.CONFLICT).body(conflict);
            }
            Loom saved = loomRepository.save(loom);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", saved);
            result.put("message", "织机创建成功");
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "创建织机失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(@PathVariable Long id, @RequestBody Loom loom) {
        try {
            return loomRepository.findById(id).map(existing -> {
                if (loom.getLoomName() != null) existing.setLoomName(loom.getLoomName());
                if (loom.getLocation() != null) existing.setLocation(loom.getLocation());
                if (loom.getStatus() != null) existing.setStatus(loom.getStatus());
                if (loom.getTotalWarpCount() != null) existing.setTotalWarpCount(loom.getTotalWarpCount());
                if (loom.getWeftDensityTarget() != null) existing.setWeftDensityTarget(loom.getWeftDensityTarget());
                Loom updated = loomRepository.save(existing);
                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("data", updated);
                result.put("message", "织机更新成功");
                return ResponseEntity.ok(result);
            }).orElseGet(() -> {
                Map<String, Object> notFound = new HashMap<>();
                notFound.put("success", false);
                notFound.put("message", "织机不存在: " + id);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
            });
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "更新织机失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable Long id) {
        try {
            if (!loomRepository.existsById(id)) {
                Map<String, Object> notFound = new HashMap<>();
                notFound.put("success", false);
                notFound.put("message", "织机不存在: " + id);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
            }
            loomRepository.deleteById(id);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "织机删除成功");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "删除织机失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
