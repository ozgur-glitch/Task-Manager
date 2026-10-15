import React, { useState, useEffect, useRef } from 'react';
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
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

const STORAGE_KEY = '@task_manager_tasks_v2';

// Handler für Benachrichtigungen im Vordergrund
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';

  const [tasks, setTasks] = useState([]);
  const [taskText, setTaskText] = useState('');
  const [category, setCategory] = useState('Alltag');
  const [priority, setPriority] = useState('Mittel'); // Hoch, Mittel, Tief
  const [dueDateText, setDueDateText] = useState(''); // Format: YYYY-MM-DD HH:MM
  const [repeat, setRepeat] = useState('Einmalig'); // Einmalig, Täglich, Wöchentlich, Monatlich

  // Suche, Filter & Sortierung
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Alle'); // Alle, Offen, Erledigt
  const [sortBy, setSortBy] = useState('date'); // 'date' oder 'priority'

  useEffect(() => {
    requestNotificationPermissions();
    loadTasks();
  }, []);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push-Benachrichtigungen wurden vom Nutzer nicht erlaubt.');
    }
  };

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

  const scheduleNotification = async (title, body, dateString) => {
    try {
      if (!dateString) return null;
      const targetDate = new Date(dateString);
      if (isNaN(targetDate.getTime()) || targetDate <= new Date()) return null;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Erinnerung: ${title}`,
          body: body || 'Eine Aufgabe steht jetzt an!',
          sound: true,
        },
        trigger: targetDate,
      });
      return notificationId;
    } catch (error) {
      console.log('Erinnerung konnte nicht geplant werden:', error);
      return null;
    }
  };

  const cancelNotification = async (notificationId) => {
    if (notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch (error) {
        console.log('Erinnerung konnte nicht storniert werden:', error);
      }
    }
  };

  const addTask = async () => {
    if (taskText.trim() === '') {
      Alert.alert('Hinweis', 'Bitte gib einen Task-Text ein.');
      return;
    }

    let notifId = null;
    if (dueDateText.trim() !== '') {
      notifId = await scheduleNotification(
        taskText,
        `Fällig am ${dueDateText}`,
        dueDateText
      );
    }

    const newTask = {
      id: Date.now().toString(),
      text: taskText,
      completed: false,
      category: category,
      priority: priority,
      dueDate: dueDateText.trim() !== '' ? dueDateText.trim() : null,
      repeat: repeat,
      notificationId: notifId,
      createdAt: new Date().toISOString(),
    };

    setTasks([newTask, ...tasks]);
    setTaskText('');
    setDueDateText('');
    setRepeat('Einmalig');
  };

  const toggleTask = async (id) => {
    const updatedTasks = [];

    for (let task of tasks) {
      if (task.id === id) {
        const newCompletedState = !task.completed;

        if (newCompletedState && task.notificationId) {
          await cancelNotification(task.notificationId);
        }

        // Wenn die Aufgabe erledigt wird und wiederkehrend ist, erstelle die nächste Instanz
        if (newCompletedState && task.repeat !== 'Einmalig') {
          let nextDueDate = null;
          if (task.dueDate) {
            const current = new Date(task.dueDate);
            if (!isNaN(current.getTime())) {
              if (task.repeat === 'Täglich') current.setDate(current.getDate() + 1);
              if (task.repeat === 'Wöchentlich') current.setDate(current.getDate() + 7);
              if (task.repeat === 'Monatlich') current.setMonth(current.getMonth() + 1);
              nextDueDate = current.toISOString().slice(0, 16).replace('T', ' ');
            }
          }

          let nextNotifId = null;
          if (nextDueDate) {
            nextNotifId = await scheduleNotification(
              task.text,
              `Wiederkehrende Aufgabe: ${nextDueDate}`,
              nextDueDate
            );
          }

          const recurringTask = {
            ...task,
            id: Date.now().toString(),
            completed: false,
            dueDate: nextDueDate,
            notificationId: nextNotifId,
            createdAt: new Date().toISOString(),
          };

          updatedTasks.push({ ...task, completed: true, notificationId: null });
          updatedTasks.push(recurringTask);
        } else {
          updatedTasks.push({ ...task, completed: newCompletedState });
        }
      } else {
        updatedTasks.push(task);
      }
    }

    setTasks(updatedTasks);
  };

  const deleteTask = async (id) => {
    const taskToDelete = tasks.find((t) => t.id === id);
    if (taskToDelete && taskToDelete.notificationId) {
      await cancelNotification(taskToDelete.notificationId);
    }
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

  const getPriorityWeight = (prio) => {
    switch (prio) {
      case 'Hoch': return 3;
      case 'Mittel': return 2;
      case 'Tief': return 1;
      default: return 0;
    }
  };

  // Suche, Filter und Sortierung anwenden
  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch = task.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            task.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filter === 'Offen') return !task.completed;
      if (filter === 'Erledigt') return task.completed;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
      } else {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

  const themeStyles = {
    bg: isDark ? '#121212' : '#f8f9fa',
    cardBg: isDark ? '#1e1e1e' : '#ffffff',
    text: isDark ? '#ffffff' : '#2f3542',
    subText: isDark ? '#a0a0a0' : '#747d8c',
    inputBg: isDark ? '#2c2c2c' : '#f1f2f6',
    border: isDark ? '#333333' : '#dfe4ea',
    headerBg: isDark ? '#1a1a24' : '#1e1e2f',
  };

  const renderItem = ({ item }) => (
    <View style={[styles.taskCard, { backgroundColor: themeStyles.cardBg }, item.completed && styles.taskCompletedCard]}>
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
            { color: themeStyles.text },
            item.completed && styles.taskTextCompleted,
          ]}
        >
          {item.text}
        </Text>
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: isDark ? '#333' : '#f1f2f6' }]}>
            <Text style={[styles.badgeText, { color: themeStyles.subText }]}>{item.category}</Text>
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
          {item.repeat !== 'Einmalig' && (
            <View style={[styles.badge, { backgroundColor: '#706fd320' }]}>
              <Text style={[styles.badgeText, { color: '#706fd3' }]}>🔄 {item.repeat}</Text>
            </View>
          )}
        </View>
        {item.dueDate && (
          <Text style={[styles.dueDateText, { color: themeStyles.subText }]}>
            ⏰ Fällig: {item.dueDate}
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={() => deleteTask(item.id)} style={styles.deleteButton}>
        <Ionicons name="trash-outline" size={20} color="#ff4757" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeStyles.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={themeStyles.headerBg} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeStyles.headerBg }]}>
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
        <View style={[styles.inputCard, { backgroundColor: themeStyles.cardBg }]}>
          <TextInput
            style={[styles.input, { backgroundColor: themeStyles.inputBg, color: themeStyles.text }]}
            placeholder="Neuen Task hinzufügen..."
            placeholderTextColor="#a4b0be"
            value={taskText}
            onChangeText={setTaskText}
          />

          <TextInput
            style={[styles.input, { backgroundColor: themeStyles.inputBg, color: themeStyles.text }]}
            placeholder="Fälligkeit (z.B. 2026-12-31 18:00)"
            placeholderTextColor="#a4b0be"
            value={dueDateText}
            onChangeText={setDueDateText}
          />

          {/* Optionen: Priorität & Wiederholung */}
          <View style={styles.optionsRow}>
            <View style={styles.selectorGroup}>
              <Text style={[styles.selectorLabel, { color: themeStyles.subText }]}>Prio:</Text>
              {['Hoch', 'Mittel', 'Tief'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.optionChip,
                    { backgroundColor: themeStyles.inputBg },
                    priority === p && { backgroundColor: getPriorityColor(p) },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: themeStyles.subText },
                      priority === p && { color: '#fff' },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.optionsRow}>
            <View style={styles.selectorGroup}>
              <Text style={[styles.selectorLabel, { color: themeStyles.subText }]}>Repeat:</Text>
              {['Einmalig', 'Täglich', 'Wöchentlich', 'Monatlich'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.optionChip,
                    { backgroundColor: themeStyles.inputBg },
                    repeat === r && { backgroundColor: '#706fd3' },
                  ]}
                  onPress={() => setRepeat(r)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: themeStyles.subText },
                      repeat === r && { color: '#fff' },
                    ]}
                  >
                    {r}
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

        {/* Volltext-Suche & Sortierung */}
        <View style={styles.searchSortRow}>
          <View style={[styles.searchBox, { backgroundColor: themeStyles.cardBg }]}>
            <Ionicons name="search" size={18} color="#a4b0be" style={{ marginRight: 6 }} />
            <TextInput
              style={[styles.searchInput, { color: themeStyles.text }]}
              placeholder="Suchen..."
              placeholderTextColor="#a4b0be"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: themeStyles.cardBg }]}
            onPress={() => setSortBy(sortBy === 'date' ? 'priority' : 'date')}
          >
            <Ionicons name="swap-vertical" size={18} color="#3742fa" />
            <Text style={styles.sortButtonText}>
              {sortBy === 'date' ? 'Datum' : 'Prio'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.filterRow, { backgroundColor: themeStyles.inputBg }]}>
          {['Alle', 'Offen', 'Erledigt'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterTab,
                filter === f && [styles.filterTabActive, { backgroundColor: themeStyles.cardBg }],
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: themeStyles.subText },
                  filter === f && { color: themeStyles.text },
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
              <Text style={styles.emptyText}>Keine Aufgaben gefunden</Text>
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
  },
  header: {
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
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  selectorLabel: {
    fontSize: 12,
    marginRight: 6,
    fontWeight: '600',
  },
  optionChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  optionChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#3742fa',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  searchSortRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  sortButtonText: {
    color: '#3742fa',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  filterRow: {
    flexDirection: 'row',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 20,
  },
  taskCard: {
    flexDirection: 'row',
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
    opacity: 0.6,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#a4b0be',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dueDateText: {
    fontSize: 11,
    marginTop: 4,
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
    fontSize: 15,
    color: '#a4b0be',
  },
});
