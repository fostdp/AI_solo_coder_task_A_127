package com.yunjin.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "fabric_analysis", indexes = {
    @Index(name = "idx_fabric_analysis_loom_id", columnList = "loom_id")
})
public class FabricAnalysis {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "loom_id", nullable = false)
    private Long loomId;

    @Column(name = "analysis_type", nullable = false, length = 50)
    private String analysisType;

    @Column(name = "weave_pattern", length = 50)
    private String weavePattern;

    @Column(name = "warp_count")
    private Integer warpCount;

    @Column(name = "weft_count")
    private Integer weftCount;

    @Column(name = "texture_data", columnDefinition = "TEXT")
    private String textureData;

    @Column(name = "fft_spectrum", columnDefinition = "TEXT")
    private String fftSpectrum;

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
