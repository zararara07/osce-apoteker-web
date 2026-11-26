// ============================================================================
// JEMBATAN KOMUNIKASI 2 ARAH: WEB (REACT/JS) <-> GODOT 4.3+ WEB
// Penanggung Jawab: AZZAHRA + 1 Orang Tim 3D Godot
// ============================================================================

/**
 * Mendaftarkan listener agar Godot bisa mengirim event klik 3D ke Web.
 * Di GDScript Godot, Tim 3D cukup memanggil:
 *   JavaScriptBridge.eval("window.onGodotEvent('WASH_HANDS', {})")
 */
export function registerGodotListener(onEventCallback) {
  window.onGodotEvent = (eventCode, payload = {}) => {
    console.log("[Web <- Godot]", eventCode, payload);
    if (typeof onEventCallback === "function") {
      onEventCallback(eventCode, payload);
    }
  };
}

/**
 * Mengirim data Station Bundle (JSON) dari Web ke Godot.
 * Di GDScript Godot (WebBridge.gd), fungsi window.godotReceiveStation akan dipanggil.
 */
export function sendStationToGodot(stationBundle) {
  if (typeof window.godotReceiveStation === "function") {
    window.godotReceiveStation(JSON.stringify(stationBundle));
    return true;
  }
  console.warn("[Web -> Godot] Godot belum terpasang di halaman ini (mode mock).");
  return false;
}

/**
 * Memerintahkan Godot memutar animasi NPC (misal: TALK_LIPSYNC, IDLE, APPROVE_ACC).
 */
export function triggerGodotNpcAnim(animName) {
  if (typeof window.godotPlayNpcAnim === "function") {
    window.godotPlayNpcAnim(animName);
    return true;
  }
  console.log("[Web -> Godot Mock] Play NPC Anim:", animName);
  return false;
}
