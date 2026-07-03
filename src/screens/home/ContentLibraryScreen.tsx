import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { useContentCategories, useContentItems } from "../../api/content-library/Hooks";
import { ContentCategory, ContentItem } from "../../api/content-library/Dto";
import { STACK_ROUTES } from "../../navigations/Routes";

export default function ContentLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | null>(null);
  const [sortBy, setSortBy] = useState<"Newest" | "A-Z" | "Z-A">("Newest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const { data: categories = [], isLoading: loadingCats } = useContentCategories();
  // Fetch ALL items to count them by category
  const { data: allItems = [], isLoading: loadingItems } = useContentItems();

  const getItemsForCategory = (categoryId: string) => {
    return allItems.filter(item => item.category_id === categoryId);
  };

  const getFileIconProps = (fileType: string): { name: any, color: string, bgColor: string } => {
    if (fileType?.startsWith("image/")) {
      return { name: "image-outline", color: "#3b82f6", bgColor: "#eff6ff" }; // Blue
    }
    if (fileType?.startsWith("audio/")) {
      return { name: "headphones", color: "#a855f7", bgColor: "#faf5ff" }; // Purple
    }
    if (fileType?.startsWith("video/")) {
      return { name: "play-circle-outline", color: "#f59e0b", bgColor: "#fffbeb" }; // Yellow
    }
    // Default to document (PDF, docx, etc.)
    return { name: "file-document-outline", color: "#ef4444", bgColor: "#fef2f2" }; // Red
  };

  const renderFolderList = () => {
    let filteredCategories = categories.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filteredCategories.sort((a, b) => {
      if (sortBy === "A-Z") {
        return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
      } else if (sortBy === "Z-A") {
        return (b.name || "").toLowerCase().localeCompare((a.name || "").toLowerCase());
      } else {
        // Newest: sort by created_at descending
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      }
    });

    return (
      <>
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>SORT BY:</Text>
          <View style={{ zIndex: 10 }}>
            <TouchableOpacity 
              style={styles.sortDropdown}
              onPress={() => setShowSortDropdown(!showSortDropdown)}
            >
              <Text style={styles.sortDropdownText}>{sortBy}</Text>
              <MaterialCommunityIcons name={showSortDropdown ? "chevron-up" : "chevron-down"} size={18} color="#475569" />
            </TouchableOpacity>
            
            {showSortDropdown && (
              <View style={styles.dropdownMenu}>
                {(["Newest", "A-Z", "Z-A"] as const).map(option => (
                  <TouchableOpacity 
                    key={option} 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSortBy(option);
                      setShowSortDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, sortBy === option && styles.dropdownItemTextSelected]}>{option}</Text>
                    {sortBy === option && <MaterialCommunityIcons name="check" size={16} color="#3b82f6" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const itemCount = getItemsForCategory(item.id).length;
            return (
              <TouchableOpacity
                style={styles.folderCard}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(item)}
              >
                <View style={styles.folderIconContainer}>
                  <MaterialCommunityIcons name="folder-outline" size={24} color="#3b82f6" />
                </View>
                <View style={styles.folderTextContainer}>
                  <Text style={styles.folderTitle}>{item.name}</Text>
                  <Text style={styles.folderSubtitle}>
                    {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No folders found</Text>
            </View>
          }
        />
      </>
    );
  };

  const renderItemList = () => {
    if (!selectedCategory) return null;

    let items = getItemsForCategory(selectedCategory.id);
    if (searchQuery) {
      items = items.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply the global sort to items as well
    items.sort((a, b) => {
      if (sortBy === "A-Z") {
        return (a.title || "").toLowerCase().localeCompare((b.title || "").toLowerCase());
      } else if (sortBy === "Z-A") {
        return (b.title || "").toLowerCase().localeCompare((a.title || "").toLowerCase());
      } else {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      }
    });

    return (
      <>
        <View style={styles.categoryHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setSelectedCategory(null)}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.categoryHeaderTitle}>{selectedCategory.name}</Text>
            <Text style={styles.categoryHeaderSubtitle}>
              {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
          </View>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const iconProps = getFileIconProps(item.file_type);
            return (
              <TouchableOpacity
                style={styles.itemCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate(STACK_ROUTES.CONTENT_VIEWER, { item })}
              >
                <View style={[styles.itemIconContainer, { backgroundColor: iconProps.bgColor }]}>
                  <MaterialCommunityIcons name={iconProps.name} size={24} color={iconProps.color} />
                </View>
                <View style={styles.itemTextContainer}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle} numberOfLines={1}>{item.description}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No items found in this folder</Text>
            </View>
          }
        />
      </>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={22} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses, folders or topics..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {(loadingCats || loadingItems) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        selectedCategory ? renderItemList() : renderFolderList()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: "#0f172a",
  },
  sortContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginRight: 8,
    letterSpacing: 0.5,
  },
  sortDropdown: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
    minWidth: 100,
    justifyContent: "space-between",
  },
  sortDropdownText: {
    fontSize: 13,
    color: "#1e293b",
    marginRight: 4,
    fontWeight: "500",
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    minWidth: 120,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownItemText: {
    fontSize: 13,
    color: "#475569",
  },
  dropdownItemTextSelected: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  categoryHeaderSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  folderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  folderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  folderTextContainer: {
    flex: 1,
  },
  folderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  folderSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    letterSpacing: 0.5,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  itemIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#94a3b8",
    fontWeight: "500",
  },
});
