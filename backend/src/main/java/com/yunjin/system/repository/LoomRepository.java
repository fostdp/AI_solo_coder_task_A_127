package com.yunjin.system.repository;

import com.yunjin.system.entity.Loom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface LoomRepository extends JpaRepository<Loom, Long> {
    Optional<Loom> findByLoomCode(String loomCode);
}
