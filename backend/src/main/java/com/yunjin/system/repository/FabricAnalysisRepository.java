package com.yunjin.system.repository;

import com.yunjin.system.entity.FabricAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FabricAnalysisRepository extends JpaRepository<FabricAnalysis, Long> {
    List<FabricAnalysis> findByLoomIdOrderByCreatedAtDesc(Long loomId);
}
