import numpy as np
from typing import Any


def _kmeans(embeddings: np.ndarray, k: int, iterations: int = 30) -> tuple[float, np.ndarray]:
    if len(embeddings) <= k:
        return 0.0, embeddings.copy()

    # Deterministic farthest-point initialization avoids pulling in sklearn for
    # a small elbow-method helper used only during face mapping.
    centroids = [embeddings[0]]
    while len(centroids) < k:
        distances = np.min(
            np.linalg.norm(embeddings[:, None, :] - np.array(centroids)[None, :, :], axis=2),
            axis=1,
        )
        centroids.append(embeddings[int(np.argmax(distances))])
    centroids = np.array(centroids)

    labels = np.zeros(len(embeddings), dtype=np.int32)
    for _ in range(iterations):
        distances = np.linalg.norm(embeddings[:, None, :] - centroids[None, :, :], axis=2)
        next_labels = np.argmin(distances, axis=1)
        next_centroids = centroids.copy()
        for idx in range(k):
            members = embeddings[next_labels == idx]
            if len(members):
                next_centroids[idx] = members.mean(axis=0)
        if np.array_equal(labels, next_labels) and np.allclose(centroids, next_centroids):
            break
        labels = next_labels
        centroids = next_centroids

    inertia = float(
        np.sum(np.linalg.norm(embeddings - centroids[labels], axis=1) ** 2)
    )
    return inertia, centroids


def find_cluster_centroids(embeddings, max_k=10) -> Any:
    embeddings = np.asarray(embeddings, dtype=np.float32)
    if len(embeddings) == 0:
        return []
    if len(embeddings) == 1:
        return embeddings

    inertia = []
    cluster_centroids = []
    K = range(1, min(max_k, len(embeddings)) + 1)

    for k in K:
        score, centroids = _kmeans(embeddings, k)
        inertia.append(score)
        cluster_centroids.append({"k": k, "centroids": centroids})

    if len(cluster_centroids) == 1:
        return cluster_centroids[0]["centroids"]

    diffs = [inertia[i] - inertia[i+1] for i in range(len(inertia)-1)]
    optimal_centroids = cluster_centroids[diffs.index(max(diffs)) + 1]['centroids']

    return optimal_centroids

def find_closest_centroid(centroids: list, normed_face_embedding) -> list:
    try:
        centroids = np.array(centroids)
        normed_face_embedding = np.array(normed_face_embedding)
        similarities = np.dot(centroids, normed_face_embedding)
        closest_centroid_index = np.argmax(similarities)
        
        return closest_centroid_index, centroids[closest_centroid_index]
    except ValueError:
        return None
