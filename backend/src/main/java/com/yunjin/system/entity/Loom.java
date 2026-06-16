package com.yunjin.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "loom")
public class Loom {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "loom_code", unique = true, nullable = false, length = 50)
    private String loomCode;

    @Column(name = "loom_name", nullable = false, length = 100)
    private String loomName;

    @Column(length = 200)
    private String location;

    @Column(length = 20)
    private String status = "IDLE";

    @Column(name = "total_warp_count")
    private Integer totalWarpCount = 1200;

    @Column(name = "weft_density_target")
    private Double weftDensityTarget = 60.0;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
