package com.yunjin.system.repository;

import com.yunjin.system.entity.WeavingSimulation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface WeavingSimulationRepository extends JpaRepository<WeavingSimulation, Long> {
    Optional<WeavingSimulation> findByLoomId(Long loomId);
}
