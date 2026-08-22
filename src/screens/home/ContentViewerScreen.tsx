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
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { useVideoPlayer, VideoView } from "expo-video";
import * as FileSystem from "expo-file-system/legacy";
import { useKeepAwake, activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { ContentItem } from "../../api/content-library/Dto";
import AudioContentViewer from "../../components/content/AudioContentViewer";

export default function ContentViewerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const item: ContentItem = route.params?.item;

  const [loading, setLoading] = useState(true);
  const [textContent, setTextContent] = useState<string>("");
  const [textLoading, setTextLoading] = useState(false);


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

  const isPdf = file_type?.includes("pdf") || file_url.toLowerCase().endsWith(".pdf");
  const isText = file_type?.startsWith("text/") || 
                 file_url.toLowerCase().endsWith(".txt") || 
                 file_url.toLowerCase().endsWith(".csv") ||
                 file_url.toLowerCase().endsWith(".json") ||
                 file_url.toLowerCase().endsWith(".xml");

  const isOfficeDoc = file_type?.includes("document") || 
                       file_type?.includes("msword") || 
                       file_type?.includes("spreadsheet") || 
                       file_type?.includes("excel") || 
                       file_type?.includes("presentation") || 
                       file_type?.includes("powerpoint") || 
                       /\.(doc|docx|xls|xlsx|ppt|pptx)($|\?)/i.test(file_url);

  useEffect(() => {
    if (isDocument && isText) {
      setTextLoading(true);
      fetch(file_url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP status ${res.status}`);
          return res.text();
        })
        .then((text) => {
          setTextContent(text);
          setTextLoading(false);
          setLoading(false);
        })
        .catch((error) => {
          console.error("[ContentViewer] Error loading text file:", error);
          setTextLoading(false);
          setLoading(false);
          Alert.alert("Load Error", "Failed to load plain text file content.");
        });
    }
  }, [file_url, file_type, isDocument, isText]);

  // Keep screen awake when viewing video in Content Library
  useEffect(() => {
    if (isVideo) {
      activateKeepAwakeAsync("ContentViewerVideo").catch(() => {});
    } else {
      deactivateKeepAwake("ContentViewerVideo").catch(() => {});
    }
    return () => {
      deactivateKeepAwake("ContentViewerVideo").catch(() => {});
    };
  }, [isVideo]);

  // Modern expo-video player hook (only initialize video source for videos)
  const player = useVideoPlayer(isVideo ? file_url : null, (player) => {
    if (player) {
      player.loop = false;
      player.keepScreenOnWhilePlaying = true;
      if (isVideo) player.play();
    }
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

    if (isVideo) {
      return (
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.videoContent}
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture
            showsTimecodes
            nativeControls
          />
        </View>
      );
    }

    if (isAudio) {
      return (
        <AudioContentViewer
          audioUrl={file_url}
          title={title}
          category={(item as any)?.category_name ?? "Audio Track"}
        />
      );
    }

    if (isDocument) {
      if (isText) {
        if (textLoading) {
          return (
            <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
          );
        }
        return (
          <ScrollView contentContainerStyle={styles.textScrollView} showsVerticalScrollIndicator={true}>
            <Text style={styles.textTextContent}>{textContent}</Text>
          </ScrollView>
        );
      }

      let urlToRender = "";
      if (isPdf) {
        urlToRender = `https://docs.google.com/viewer?url=${encodeURIComponent(file_url)}&embedded=true`;
      } else if (isOfficeDoc) {
        urlToRender = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file_url)}`;
      } else {
        urlToRender = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file_url)}`;
      }

      return (
        <WebView
          source={{ uri: urlToRender }}
          style={styles.webviewContent}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn("[ContentViewer] WebView error:", nativeEvent);
            setLoading(false);
            Alert.alert(
              "Load Error",
              "Failed to load document preview. You can use the download button to open/download the file."
            );
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
        {(isImage || isDocument) && loading && (
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
  textScrollView: {
    padding: 20,
    backgroundColor: "#ffffff",
  },
  textTextContent: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
  },
});
