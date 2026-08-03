import { useEffect } from "react";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

export interface RealtimePayload<T> {
  new: T;
  old: Partial<T>;
  eventType: string;
  table: string;
  schema: string;
}

export interface RealtimeSubscriptionOptions<T extends Record<string, any>> {
  table: string;
  schema?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  channelName?: string;
  onPayload: (payload: RealtimePayload<T>) => void;
}

export function useRealtimeSubscription<T extends Record<string, any>>({
  table,
  schema = "public",
  event = "*",
  filter,
  channelName,
  onPayload,
}: RealtimeSubscriptionOptions<T>) {
  useEffect(() => {
    const uniqueChannelName =
      channelName || `realtime:${table}:${event}:${filter || "all"}:${Date.now()}`;

    const channel: RealtimeChannel = supabase
      .channel(uniqueChannelName)
      .on(
        "postgres_changes" as any,
        {
          event,
          schema,
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          onPayload({
            new: (payload.new || {}) as T,
            old: (payload.old || {}) as Partial<T>,
            eventType: payload.eventType,
            table: payload.table,
            schema: payload.schema,
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] Subscribed to ${table} (${event})`);
        } else if (status === "CHANNEL_ERROR") {
          console.warn(`[Realtime] Subscription error on ${table}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, schema, event, filter, channelName]);
}
