# ============================================================================
# WebBridge.gd — Pasang sebagai Autoload di Godot 4.3+ (Export Web Single-Threaded)
# Untuk: Tim 3D (Godot) agar bisa berkomunikasi 2 arah dengan Halaman Web Azzahra
# ============================================================================
extends Node

signal station_bundle_received(bundle_dict: Dictionary)
signal npc_anim_requested(anim_name: String)

# Simpan referensi callback agar tidak di-garbage-collect oleh JavaScriptBridge
var _cb_receive_station = null
var _cb_play_npc_anim = null

func _ready() -> void:
	if OS.has_feature("web"):
		var window = JavaScriptBridge.get_interface("window")
		_cb_receive_station = JavaScriptBridge.create_callback(_on_web_station_received)
		_cb_play_npc_anim = JavaScriptBridge.create_callback(_on_web_play_npc_anim)

		window.godotReceiveStation = _cb_receive_station
		window.godotPlayNpcAnim = _cb_play_npc_anim
		print("[Godot WebBridge] Siap menerima perintah dari Web!")

# Dipanggil oleh Web JS saat peserta masuk station baru
func _on_web_station_received(args: Array) -> void:
	if args.size() > 0:
		var parsed = JSON.parse_string(str(args[0]))
		if typeof(parsed) == TYPE_DICTIONARY:
			emit_signal("station_bundle_received", parsed)

# Dipanggil oleh Web JS saat NPC membalas suara mikrofon peserta
func _on_web_play_npc_anim(args: Array) -> void:
	if args.size() > 0:
		emit_signal("npc_anim_requested", str(args[0]))

# Panggil fungsi ini dari objek 3D Godot saat diklik peserta!
# Contoh: WebBridge.send_event_to_web("WASH_HANDS", {"station": 3})
func send_event_to_web(event_code: String, payload: Dictionary = {}) -> void:
	if OS.has_feature("web"):
		var json_payload = JSON.stringify(payload)
		var js = "window.onGodotEvent && window.onGodotEvent('%s', %s);" % [event_code, json_payload]
		JavaScriptBridge.eval(js)
	else:
		print("[Godot WebBridge - Local Editor] Event:", event_code, payload)
