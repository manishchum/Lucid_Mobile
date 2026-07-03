import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { useVideoPlayer, VideoView } from "expo-video";
import * as FileSystem from "expo-file-system/legacy";

import { ContentItem } from "../../api/content-library/Dto";

export default function ContentViewerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const item: ContentItem = route.params?.item;

  const [loading, setLoading] = useState(true);

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Content item not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { file_url, file_type, title } = item;

  const isImage = file_type?.startsWith("image/");
  const isVideo = file_type?.startsWith("video/");
  const isAudio = file_type?.startsWith("audio/");
  const isDocument = !isImage && !isVideo && !isAudio;

  // Modern expo-video player hook
  const player = useVideoPlayer(file_url, player => {
    player.loop = false;
    player.play();
  });

  const handleDownload = async () => {
    try {
      // By using Linking to open the URL directly, the OS handles the download in the background natively.
      // This is infinitely faster than downloading it via JS into memory and then trying to share it!
      const canOpen = await Linking.canOpenURL(file_url);
      if (canOpen) {
        await Linking.openURL(file_url);
      } else {
        Alert.alert("Error", "Cannot open this file URL for download.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Download Failed", "There was an error triggering the download.");
    }
  };

  const renderContent = () => {
    if (isImage) {
      return (
        <Image
          source={{ uri: file_url }}
          style={styles.imageContent}
          resizeMode="contain"
          onLoadEnd={() => setLoading(false)}
        />
      );
    }

    if (isVideo || isAudio) {
      return (
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.videoContent}
            allowsFullscreen
            allowsPictureInPicture
            showsTimecodes
            nativeControls
          />
        </View>
      );
    }

    if (isDocument) {
      // Use Mozilla's robust PDF.js viewer for PDFs instead of Google Docs which aggressively downloads.
      // For non-PDF documents (docx, xlsx), fallback to a better Google Docs Viewer wrapper.
      const isPdf = file_type?.includes("pdf") || file_url.toLowerCase().endsWith(".pdf");
      
      let urlToRender;
      if (isPdf) {
        urlToRender = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file_url)}`;
      } else {
        urlToRender = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file_url)}`;
      }

      return (
        <WebView
          source={{ uri: urlToRender }}
          style={styles.webviewContent}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            Alert.alert("Load Error", "Failed to load document.");
          }}
          startInLoadingState={true}
          renderLoading={() => (
            <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
          )}
        />
      );
    }

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Unsupported file format.</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>

        <TouchableOpacity style={styles.headerBtn} onPress={handleDownload}>
          <MaterialCommunityIcons name="download" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentWrapper}>
        {(isImage) && loading && (
          <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
        )}
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerBtn: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    marginHorizontal: 16,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    position: "relative",
  },
  loader: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -18 }, { translateY: -18 }],
    zIndex: 10,
  },
  imageContent: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  videoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  videoContent: {
    width: "100%",
    height: "100%",
  },
  webviewContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
