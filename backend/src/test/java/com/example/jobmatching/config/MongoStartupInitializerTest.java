package com.example.jobmatching.config;

import com.mongodb.client.ListCollectionNamesIterable;
import com.mongodb.client.ListSearchIndexesIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MongoStartupInitializerTest {

    @Test
    void runSkipsCollectionCreationWhenAllCollectionsAlreadyExist() throws Exception {
        MongoDatabase database = mockDatabase(
                List.of(
                        MongoSchemaConstants.JOBS_COLLECTION,
                        MongoSchemaConstants.CANDIDATES_COLLECTION,
                        MongoSchemaConstants.MATCHES_COLLECTION),
                readyIndex(MongoSchemaConstants.JOBS_VECTOR_INDEX),
                readyIndex(MongoSchemaConstants.CANDIDATES_VECTOR_INDEX));

        MongoStartupInitializer initializer = new MongoStartupInitializer(database);

        assertDoesNotThrow(() -> initializer.run(new DefaultApplicationArguments(new String[0])));

        verify(database, never()).createCollection(any());
    }

    @Test
    void runCreatesOnlyMissingCollections() throws Exception {
        MongoDatabase database = mockDatabase(
                List.of(MongoSchemaConstants.JOBS_COLLECTION),
                readyIndex(MongoSchemaConstants.JOBS_VECTOR_INDEX),
                readyIndex(MongoSchemaConstants.CANDIDATES_VECTOR_INDEX));

        MongoStartupInitializer initializer = new MongoStartupInitializer(database);

        initializer.run(new DefaultApplicationArguments(new String[0]));

        verify(database, times(1)).createCollection(MongoSchemaConstants.CANDIDATES_COLLECTION);
        verify(database, times(1)).createCollection(MongoSchemaConstants.MATCHES_COLLECTION);
        verify(database, never()).createCollection(MongoSchemaConstants.JOBS_COLLECTION);
    }

    @Test
    void runPassesWhenRequiredVectorIndexesAreReadyAndQueryable() {
        MongoDatabase database = mockDatabase(
                List.of(
                        MongoSchemaConstants.JOBS_COLLECTION,
                        MongoSchemaConstants.CANDIDATES_COLLECTION,
                        MongoSchemaConstants.MATCHES_COLLECTION),
                readyIndex(MongoSchemaConstants.JOBS_VECTOR_INDEX),
                readyIndex(MongoSchemaConstants.CANDIDATES_VECTOR_INDEX));

        MongoStartupInitializer initializer = new MongoStartupInitializer(database);

        assertDoesNotThrow(() -> initializer.run(new DefaultApplicationArguments(new String[0])));
    }

    @Test
    void runFailsWhenJobsVectorIndexIsMissing() {
        MongoDatabase database = mockDatabase(
                List.of(
                        MongoSchemaConstants.JOBS_COLLECTION,
                        MongoSchemaConstants.CANDIDATES_COLLECTION,
                        MongoSchemaConstants.MATCHES_COLLECTION),
                null,
                readyIndex(MongoSchemaConstants.CANDIDATES_VECTOR_INDEX));

        MongoStartupInitializer initializer = new MongoStartupInitializer(database);

        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> initializer.run(new DefaultApplicationArguments(new String[0])));

        assertEquals(
                "Missing required Atlas Vector Search index `jobs_vector_index` on collection `jobs`. "
                        + "Create it before starting the backend.",
                exception.getMessage());
    }

    @Test
    void runFailsWhenCandidatesVectorIndexIsMissing() {
        MongoDatabase database = mockDatabase(
                List.of(
                        MongoSchemaConstants.JOBS_COLLECTION,
                        MongoSchemaConstants.CANDIDATES_COLLECTION,
                        MongoSchemaConstants.MATCHES_COLLECTION),
                readyIndex(MongoSchemaConstants.JOBS_VECTOR_INDEX),
                null);

        MongoStartupInitializer initializer = new MongoStartupInitializer(database);

        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> initializer.run(new DefaultApplicationArguments(new String[0])));

        assertEquals(
                "Missing required Atlas Vector Search index `candidates_vector_index` on collection `candidates`. "
                        + "Create it before starting the backend.",
                exception.getMessage());
    }

    @Test
    void runFailsWhenJobsVectorIndexIsNotQueryable() {
        MongoDatabase database = mockDatabase(
                List.of(
                        MongoSchemaConstants.JOBS_COLLECTION,
                        MongoSchemaConstants.CANDIDATES_COLLECTION,
                        MongoSchemaConstants.MATCHES_COLLECTION),
                new Document("name", MongoSchemaConstants.JOBS_VECTOR_INDEX)
                        .append("status", "BUILDING")
                        .append("queryable", false),
                readyIndex(MongoSchemaConstants.CANDIDATES_VECTOR_INDEX));

        MongoStartupInitializer initializer = new MongoStartupInitializer(database);

        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> initializer.run(new DefaultApplicationArguments(new String[0])));

        assertEquals(
                "Atlas Vector Search index `jobs_vector_index` on collection `jobs` is not queryable. "
                        + "Current status=BUILDING, queryable=false. Create or fix it before starting the backend.",
                exception.getMessage());
    }

    @Test
    void matcherServiceUsesValidatedSharedIndexNames() {
        assertEquals("jobs_vector_index", MongoSchemaConstants.JOBS_VECTOR_INDEX);
        assertEquals("candidates_vector_index", MongoSchemaConstants.CANDIDATES_VECTOR_INDEX);
    }

    private MongoDatabase mockDatabase(
            List<String> existingCollections,
            Document jobsIndex,
            Document candidatesIndex) {
        MongoDatabase database = mock(MongoDatabase.class);
        ListCollectionNamesIterable collectionNames = mockCollectionNamesIterable(existingCollections);
        MongoCollection<Document> jobsCollection = mockCollectionWithIndexes(jobsIndex);
        MongoCollection<Document> candidatesCollection = mockCollectionWithIndexes(candidatesIndex);
        MongoCollection<Document> matchesCollection = mockCollectionWithIndexes(null);

        when(database.runCommand(any(Document.class))).thenReturn(new Document("ok", 1));
        when(database.listCollectionNames()).thenReturn(collectionNames);
        when(database.getCollection(MongoSchemaConstants.JOBS_COLLECTION)).thenReturn(jobsCollection);
        when(database.getCollection(MongoSchemaConstants.CANDIDATES_COLLECTION)).thenReturn(candidatesCollection);
        when(database.getCollection(MongoSchemaConstants.MATCHES_COLLECTION)).thenReturn(matchesCollection);

        return database;
    }

    private MongoCollection<Document> mockCollectionWithIndexes(Document indexDocument) {
        @SuppressWarnings("unchecked")
        MongoCollection<Document> collection = mock(MongoCollection.class);
        ListSearchIndexesIterable<Document> indexes = mockSearchIndexesIterable(indexDocument);
        when(collection.listSearchIndexes()).thenReturn(indexes);
        when(collection.createIndex(any())).thenReturn("created-index");
        return collection;
    }

    private ListCollectionNamesIterable mockCollectionNamesIterable(List<String> values) {
        return (ListCollectionNamesIterable) Proxy.newProxyInstance(
                ListCollectionNamesIterable.class.getClassLoader(),
                new Class<?>[]{ListCollectionNamesIterable.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "iterator" -> mockCursor(values);
                    case "first" -> values.isEmpty() ? null : values.getFirst();
                    case "into" -> {
                        @SuppressWarnings("unchecked")
                        List<String> target = (List<String>) args[0];
                        target.addAll(values);
                        yield target;
                    }
                    case "forEach" -> {
                        @SuppressWarnings("unchecked")
                        java.util.function.Consumer<String> consumer =
                                (java.util.function.Consumer<String>) args[0];
                        values.forEach(consumer);
                        yield null;
                    }
                    case "batchSize", "map" -> proxy;
                    default -> defaultValue(method.getReturnType());
                });
    }

    private ListSearchIndexesIterable<Document> mockSearchIndexesIterable(Document indexDocument) {
        List<Document> values = indexDocument == null ? List.of() : List.of(indexDocument);
        return (ListSearchIndexesIterable<Document>) Proxy.newProxyInstance(
                ListSearchIndexesIterable.class.getClassLoader(),
                new Class<?>[]{ListSearchIndexesIterable.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "iterator" -> mockCursor(values);
                    case "first" -> values.isEmpty() ? null : values.getFirst();
                    case "into" -> {
                        @SuppressWarnings("unchecked")
                        List<Document> target = (List<Document>) args[0];
                        target.addAll(values);
                        yield target;
                    }
                    case "forEach" -> {
                        @SuppressWarnings("unchecked")
                        java.util.function.Consumer<Document> consumer =
                                (java.util.function.Consumer<Document>) args[0];
                        values.forEach(consumer);
                        yield null;
                    }
                    case "batchSize", "maxTime", "map" -> proxy;
                    default -> defaultValue(method.getReturnType());
                });
    }

    private <T> MongoCursor<T> mockCursor(List<T> values) {
        List<T> remaining = new ArrayList<>(values);
        AtomicInteger index = new AtomicInteger();
        return (MongoCursor<T>) Proxy.newProxyInstance(
                MongoCursor.class.getClassLoader(),
                new Class<?>[]{MongoCursor.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "hasNext" -> index.get() < remaining.size();
                    case "next", "tryNext" -> index.get() < remaining.size()
                            ? remaining.get(index.getAndIncrement())
                            : null;
                    case "available" -> 0;
                    case "close", "remove", "forEachRemaining" -> null;
                    default -> defaultValue(method.getReturnType());
                });
    }

    private Document readyIndex(String indexName) {
        return new Document("name", indexName)
                .append("status", "READY")
                .append("queryable", true);
    }

    private Object defaultValue(Class<?> returnType) {
        if (!returnType.isPrimitive()) {
            return null;
        }
        if (returnType == boolean.class) {
            return false;
        }
        if (returnType == int.class) {
            return 0;
        }
        if (returnType == long.class) {
            return 0L;
        }
        if (returnType == double.class) {
            return 0d;
        }
        if (returnType == float.class) {
            return 0f;
        }
        if (returnType == short.class) {
            return (short) 0;
        }
        if (returnType == byte.class) {
            return (byte) 0;
        }
        if (returnType == char.class) {
            return '\0';
        }
        return null;
    }
}
