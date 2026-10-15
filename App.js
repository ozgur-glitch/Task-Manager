import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const STORAGE_KEY = '@task_manager_tasks_v1';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [taskText, setTaskText] = useState('');
  const [category, setCategory] = useState('Alltag');
  const [priority, setPriority] = useState('Mittel'); // Hoch, Mittel, Tief
  const [filter, setFilter] = useState('Alle'); // Alle, Offen, Erledigt

  // Daten beim Start laden
  useEffect(() => {
    loadTasks();
  }, []);

  // Daten bei Änderung speichern
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const loadTasks = async () => {
    try {
      const storedTasks = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedTasks !== null) {
        setTasks(JSON.parse(storedTasks));
      }
    } catch (error) {
      Alert.alert('Fehler', 'Tasks konnten nicht geladen werden.');
    }
  };

  const saveTasks = async (tasksToSave) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToSave));
    } catch (error) {
      Alert.alert('Fehler', 'Tasks konnten nicht gespeichert werden.');
    }
  };

  const addTask = () => {
    if (taskText.trim() === '') {
      Alert.alert('Hinweis', 'Bitte gib einen Task-Text ein.');
      return;
    }

    const newTask = {
      id: Date.now().toString(),
      text: taskText,
      completed: false,
      category: category,
      priority: priority,
      createdAt: new Date().toLocaleDateString('de-DE'),
    };

    setTasks([newTask, ...tasks]);
    setTaskText('');
  };

  const toggleTask = (id) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const getPriorityColor = (prio) => {
    switch (prio) {
      case 'Hoch': return '#ff5252';
      case 'Mittel': return '#ffb142';
      case 'Tief': return '#33d9b2';
      default: return '#706fd3';
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'Offen') return !task.completed;
    if (filter === 'Erledigt') return task.completed;
    return true;
  });

  const renderItem = ({ item }) => (
    <View style={[styles.taskCard, item.completed && styles.taskCompletedCard]}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => toggleTask(item.id)}
      >
        <Ionicons
          name={item.completed ? 'checkbox' : 'square-outline'}
          size={24}
          color={item.completed ? '#2ed573' : '#a4b0be'}
        />
      </TouchableOpacity>

      <View style={styles.taskContent}>
        <Text
          style={[
            styles.taskText,
            item.completed && styles.taskTextCompleted,
          ]}
        >
          {item.text}
        </Text>
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: '#f1f2f6' }]}>
            <Text style={styles.badgeText}>{item.category}</Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: getPriorityColor(item.priority) + '20' },
            ]}
          >
            <Text
              style={[styles.badgeText, { color: getPriorityColor(item.priority) }]}
            >
              {item.priority}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={() => deleteTask(item.id)} style={styles.deleteButton}>
        <Ionicons name="trash-outline" size={20} color="#ff4757" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1e2f" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Task Manager</Text>
        <Text style={styles.headerSubtitle}>
          {tasks.filter((t) => !t.completed).length} offene Aufgaben
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.innerContainer}
      >
        {/* Eingabebereich */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Neuen Task hinzufügen..."
            placeholderTextColor="#a4b0be"
            value={taskText}
            onChangeText={setTaskText}
          />

          {/* Optionen (Priorität & Kategorie) */}
          <View style={styles.optionsRow}>
            <View style={styles.selectorGroup}>
              <Text style={styles.selectorLabel}>Prio:</Text>
              {['Hoch', 'Mittel', 'Tief'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.optionChip,
                    priority === p && { backgroundColor: getPriorityColor(p) },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      priority === p && { color: '#fff' },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={addTask}>
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addButtonText}>Hinzufügen</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {['Alle', 'Offen', 'Erledigt'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === f && styles.filterTabTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Task Liste */}
        <FlatList
          data={filteredTasks}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={64} color="#dfe4ea" />
              <Text style={styles.emptyText}>Keine Aufgaben vorhanden</Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#1e1e2f',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a4b0be',
    marginTop: 4,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#f1f2f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2f3542',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  selectorLabel: {
    fontSize: 13,
    color: '#747d8c',
    marginRight: 8,
    fontWeight: '600',
  },
  optionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f2f6',
    marginRight: 6,
  },
  optionChipText: {
    fontSize: 12,
    color: '#57606f',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#3742fa',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#dfe4ea',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 14,
    color: '#57606f',
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#2f3542',
  },
  listContainer: {
    paddingBottom: 20,
  },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCompletedCard: {
    backgroundColor: '#f1f2f6',
    opacity: 0.8,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    fontSize: 16,
    color: '#2f3542',
    fontWeight: '500',
    marginBottom: 6,
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#a4b0be',
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#57606f',
  },
  deleteButton: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#a4b0be',
  },
});
