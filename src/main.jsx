import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { supabase } from "./supabase";
import { getOSStatusColors, getOSStatusBadgeStyle } from "./statusColors";
import StatusLegend from "./StatusLegend";

const days = [
  { name: "Lundi", color: "#1976d2" },
  { name: "Mardi", color: "#2e8b57" },
  { name: "Mercredi", color: "#f39c12" },
  { name: "Jeudi", color: "#8e44ad" },
  { name: "Vendredi", color: "#d32f2f" },
  { name: "Samedi", color: "#16a6a6" },
  { name: "Dimanche", color: "#e83e8c" },
];

const statuses = [
  "Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés",
  "Constat à vérifier", "Travaux effectués", "Constat de facturation", "En attente de validation",
  "Validé", "Validé avec réserve", "Réserve", "Correction à réaliser", "Payé", "Archivé", "En erreur", "Doublon", "Annulé",
];

const initialOS = [];
const ROLE_LABELS = { admin: "Administrateur", bureau: "Bureau / planification", equipe_terrain: "Équipe terrain", eau_de_toulouse: "Validation externe" };
const ACCESS_ROLES = [
  { value: "admin", label: "Administrateur" },
  { value: "bureau", label: "Bureau / planification" },
  { value: "equipe_terrain", label: "Équipe terrain" },
  { value: "eau_de_toulouse", label: "Validation externe" }
];

function getDayColor(day) {
  const found = days.find((d) => d.name === day);
  return found ? found.color : "#777";
}

function LocalImagePreview({ file }) {
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    if (!file || !file.type || !file.type.startsWith("image/")) { setPreviewUrl(""); return undefined; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!previewUrl) return null;
  return <img src={previewUrl} alt={file?.name || "Aperçu de la photo"} style={{ width: 88, height: 68, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />;
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [currentProfile, setCurrentProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordSetup, setPasswordSetup] = useState("");
  const [passwordSetupConfirm, setPasswordSetupConfirm] = useState("");
  const [passwordSetupError, setPasswordSetupError] = useState("");
  const [passwordSetupSaving, setPasswordSetupSaving] = useState(false);
  const [accessProfiles, setAccessProfiles] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const [accessSavingIds, setAccessSavingIds] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState("equipe_terrain");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [osList, setOsList] = useState([]);
  const [dbTeams, setDbTeams] = useState([]);
  const [dbSectors, setDbSectors] = useState([]);
  const [dbMaterials, setDbMaterials] = useState([]);
  const [materialSaveIds, setMaterialSaveIds] = useState([]);
  const [materialsError, setMaterialsError] = useState("");
  const [materialsMessage, setMaterialsMessage] = useState("");
  const [appSettings, setAppSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [bpuVersions, setBpuVersions] = useState([]);
  const [bpuLines, setBpuLines] = useState([]);
  const [bpuLoading, setBpuLoading] = useState(false);
  const [bpuSaving, setBpuSaving] = useState(false);
  const [bpuError, setBpuError] = useState("");
  const [bpuMessage, setBpuMessage] = useState("");
  const [bpuVersionName, setBpuVersionName] = useState("");
  const [bpuValidFrom, setBpuValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [bpuNotes, setBpuNotes] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamType, setNewTeamType] = useState("interne");
  const [newTeamCapacity, setNewTeamCapacity] = useState("");
  const [newTeamSectorId, setNewTeamSectorId] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [osRefreshVersion, setOsRefreshVersion] = useState(0);
  const [selectedOS, setSelectedOS] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [teamFilter, setTeamFilter] = useState("Toutes");
  const [sectorFilter, setSectorFilter] = useState("Tous");
  const [newOSFiles, setNewOSFiles] = useState([]);
  const [showNewOS, setShowNewOS] = useState(false);
  const [newOSAddress, setNewOSAddress] = useState("");
  const [newOSPostalCode, setNewOSPostalCode] = useState("");
  const [newOSCity, setNewOSCity] = useState("");
  const [newOSSectorId, setNewOSSectorId] = useState("");
  const [newOSMaterial, setNewOSMaterial] = useState("");
  const [newOSMaterialDetail, setNewOSMaterialDetail] = useState("");
  const [newOSSurface, setNewOSSurface] = useState("");
  const [newOSRehabilitationZone, setNewOSRehabilitationZone] = useState("");
  const [newOSRehabilitationOtherDetail, setNewOSRehabilitationOtherDetail] = useState("");
  const [newOSRoadSurface, setNewOSRoadSurface] = useState("");
  const [newOSSidewalkSurface, setNewOSSidewalkSurface] = useState("");
  const [newOSParticularities, setNewOSParticularities] = useState("");
  const [newOSError, setNewOSError] = useState("");
  const [newOSSaving, setNewOSSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setAuthLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => { setSession(newSession); setAuthLoading(false); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setCurrentProfile(null);
      setProfileLoading(false);
      setProfileError("");
      return undefined;
    }
    let cancelled = false;
    async function loadCurrentProfile() {
      setProfileLoading(true);
      setProfileError("");
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, display_name, email, role, organization_actor, active, team_id, must_set_password")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setCurrentProfile(null);
        setProfileError(error?.message || "Aucun profil SETOM n’est associé à ce compte.");
        setProfileLoading(false);
        return;
      }
      if (data.active !== true) {
        setCurrentProfile(null);
        setProfileError("Ce compte SETOM est désactivé. Contactez l’administrateur.");
        setProfileLoading(false);
        await supabase.auth.signOut();
        return;
      }
      setCurrentProfile(data);
      setProfileLoading(false);
    }
    loadCurrentProfile().catch((error) => {
      if (!cancelled) {
        setProfileError(error?.message || "Impossible de vérifier les accès de ce compte.");
        setCurrentProfile(null);
        setProfileLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    const handlePlanningUpdate = () => setOsRefreshVersion((version) => version + 1);
    window.addEventListener("setom:planning-updated", handlePlanningUpdate);
    return () => window.removeEventListener("setom:planning-updated", handlePlanningUpdate);
  }, []);

  useEffect(() => {
    if (!session) { setOsList([]); return; }
    let cancelled = false;
    async function loadOS() {
      const { data: rows, error } = await supabase.from("work_orders").select("*").order("creation_date", { ascending: false });
      if (error) { console.error("Erreur chargement OS :", error); return; }
      const { data: settingsRow, error: settingsLoadError } = await supabase.from("app_settings").select("id, company_name, donor_name, validator_name, os_label, standard_delay_days, enrobee_reference_capacity_m2, contract_duration_years, prices_renegotiable").order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (settingsLoadError) console.error("Erreur chargement des paramètres :", settingsLoadError);
      if (!cancelled && settingsRow) setAppSettings(settingsRow);
      const osLabel = String(settingsRow?.os_label || "OS").trim() || "OS";
      const workOrderIds = (rows || []).map((row) => row.id);
      let constats = [];
      if (workOrderIds.length) {
        const constatResult = await supabase.from("constats").select("id, work_order_id, status, reserved_at, reserve_reason, reserve_resolved_at").in("work_order_id", workOrderIds).order("created_at", { ascending: false });
        if (!constatResult.error) constats = constatResult.data || []; else console.error("Erreur chargement des réserves :", constatResult.error);
      }
      const constatByOS = new Map();
      for (const constatRow of constats) if (!constatByOS.has(constatRow.work_order_id)) constatByOS.set(constatRow.work_order_id, constatRow);
      let interventions = [];
      if (workOrderIds.length) {
        const result = await supabase.from("interventions").select("id, work_order_id, team_id, planned_date, planned_order, status").in("work_order_id", workOrderIds);
        if (!result.error) interventions = result.data || []; else console.error("Erreur chargement interventions :", result.error);
      }
      const sectorResult = await supabase.from("sectors").select("id, name, active, sort_order").order("sort_order", { ascending: true });
      const sectors = sectorResult.error ? [] : (sectorResult.data || []).filter((sector) => sector.active !== false);
      if (sectorResult.error) console.error("Erreur chargement secteurs :", sectorResult.error);
      if (!cancelled) setDbSectors(sectors);
      const sectorById = new Map(sectors.map((sector) => [sector.id, sector.name]));
      const materialResult = await supabase.from("materials").select("id, name, category, active, planning_difficulty, indicative_capacity_m2, sort_order").order("sort_order", { ascending: true });
      const materials = materialResult.error ? [] : (materialResult.data || []);
      if (materialResult.error) console.error("Erreur chargement matériaux :", materialResult.error);
      if (!cancelled) setDbMaterials(materials.map((material) => ({ ...material, planning_difficulty: String(material.planning_difficulty ?? "1"), indicative_capacity_m2: material.indicative_capacity_m2 == null ? "" : String(material.indicative_capacity_m2), sort_order: String(material.sort_order ?? "0") })));
      const teamResult = await supabase.from("teams").select("id, name, team_type, usual_sector_id, indicative_capacity, active").order("name", { ascending: true });
      const teams = teamResult.error ? [] : (teamResult.data || []);
      if (teamResult.error) console.error("Erreur chargement équipes :", teamResult.error);
      if (!cancelled) setDbTeams(teams);
      const teamById = new Map(teams.map((team) => [team.id, team.name]));
      const interventionByOS = new Map();
      for (const item of interventions) {
        if (!interventionByOS.has(item.work_order_id)) interventionByOS.set(item.work_order_id, item);
        else if (!interventionByOS.get(item.work_order_id)?.planned_date && item.planned_date) interventionByOS.set(item.work_order_id, item);
      }
      const formattedOS = (rows || []).map((row) => {
        const intervention = interventionByOS.get(row.id) || null;
        const latestConstat = constatByOS.get(row.id) || null;
        const plannedDate = intervention?.planned_date || null;
        const plannedDay = plannedDate ? new Date(plannedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long" }) : null;
        const day = plannedDay ? plannedDay.charAt(0).toUpperCase() + plannedDay.slice(1) : null;
        return {
          dbId: row.id,
          interventionId: intervention?.id || null,
          id: osLabel + "-" + new Date(row.creation_date).getFullYear() + "-" + String(row.os_number).padStart(5, "0"),
          address: String(row.address || "") + (row.city ? ", " + row.city : ""),
          work: row.material_detail || "Intervention", day, plannedDate,
          team: teamById.get(intervention?.team_id) || "Non affectée", teamId: intervention?.team_id || null,
          trade: row.material_detail || "Intervention", sector: sectorById.get(row.sector_id) || "Non classé", sectorId: row.sector_id || "", status: row.status || "Nouveau",
          constatStatus: latestConstat?.status || null, reservedAt: latestConstat?.reserved_at || null, reserveReason: latestConstat?.reserve_reason || "", reserveResolvedAt: latestConstat?.reserve_resolved_at || null,
          quantity: row.planned_surface_m2 ? String(row.planned_surface_m2) + " m²" : "",
          intervention: row.material_detail || "Intervention", rehabilitationZone: row.rehabilitation_zone,
          rehabilitationOtherDetail: row.rehabilitation_other_detail, roadSurface: row.planned_road_surface_m2,
          sidewalkSurface: row.planned_sidewalk_surface_m2, actualRoadSurface: row.actual_road_surface_m2,
          actualSidewalkSurface: row.actual_sidewalk_surface_m2, actualOtherSurface: row.actual_other_surface_m2,
          deadline: row.deadline_date, isNight: !!row.is_night,
          problemSuspended: !!row.problem_suspended, suspensionReason: row.suspension_reason || "", suspensionComment: row.suspension_comment || "", suspensionStartedAt: row.suspension_started_at || null, suspensionRestartedAt: row.suspension_restarted_at || null,
        };
      });
      if (!cancelled) setOsList(formattedOS);
    }
    loadOS().catch((e) => console.error("Erreur inattendue au chargement des OS :", e));
    return () => { cancelled = true; };
  }, [session, osRefreshVersion]);

  async function handleLogin(event) {
    event.preventDefault(); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("E-mail ou mot de passe incorrect.");
  }
  async function handleLogout() { await supabase.auth.signOut(); }

  async function finishPasswordSetup(event) {
    event.preventDefault();
    setPasswordSetupError("");
    if (passwordSetup.length < 8) { setPasswordSetupError("Choisissez un mot de passe d’au moins 8 caractères."); return; }
    if (passwordSetup !== passwordSetupConfirm) { setPasswordSetupError("Les deux mots de passe ne correspondent pas."); return; }
    setPasswordSetupSaving(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password: passwordSetup });
      if (passwordError) throw passwordError;
      const { error: completeError } = await supabase.rpc("complete_setom_invitation");
      if (completeError) throw completeError;
      setCurrentProfile((profile) => profile ? { ...profile, must_set_password: false } : profile);
      setPasswordSetup("");
      setPasswordSetupConfirm("");
    } catch (error) {
      setPasswordSetupError(error?.message || "Impossible d’enregistrer le mot de passe.");
    } finally {
      setPasswordSetupSaving(false);
    }
  }

  useEffect(() => {
    if (!session || page !== "access" || currentProfile?.role !== "admin") return;
    let cancelled = false;
    async function loadAccessProfiles() {
      setAccessLoading(true);
      setAccessError("");
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, display_name, email, role, organization_actor, active, team_id, must_set_password")
        .order("display_name", { ascending: true });
      if (cancelled) return;
      if (error) {
        setAccessError(error.message || "Impossible de charger les comptes.");
        setAccessProfiles([]);
      } else {
        setAccessProfiles(data || []);
      }
      setAccessLoading(false);
    }
    loadAccessProfiles().catch((error) => {
      if (!cancelled) { setAccessError(error?.message || "Erreur de chargement des comptes."); setAccessLoading(false); }
    });
    return () => { cancelled = true; };
  }, [session?.user?.id, page, currentProfile?.role]);

  function changeAccessProfile(userId, field, value) {
    setAccessProfiles((profiles) => profiles.map((profile) => profile.id === userId ? { ...profile, [field]: value } : profile));
    setAccessError("");
    setAccessMessage("");
  }

  async function saveAccessProfile(profile) {
    setAccessError("");
    setAccessMessage("");
    if (profile.role === "equipe_terrain" && !profile.team_id) {
      setAccessError("Choisissez une équipe pour le compte « " + (profile.display_name || profile.email) + " ».");
      return;
    }
    setAccessSavingIds((ids) => [...ids, profile.id]);
    try {
      const { data, error } = await supabase.functions.invoke("manage-setom-user", {
        body: {
          action: "update",
          user_id: profile.id,
          display_name: profile.display_name,
          role: profile.role,
          team_id: profile.role === "equipe_terrain" ? profile.team_id : null,
          active: profile.active
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.user) throw new Error("Le serveur n’a pas confirmé la mise à jour.");
      setAccessProfiles((profiles) => profiles.map((item) => item.id === profile.id ? data.user : item));
      setAccessMessage("Accès mis à jour pour " + (data.user.display_name || data.user.email) + ".");
    } catch (error) {
      setAccessError(error?.message || "Impossible d’enregistrer ces accès.");
    } finally {
      setAccessSavingIds((ids) => ids.filter((id) => id !== profile.id));
    }
  }

  async function inviteAccessUser(event) {
    event.preventDefault();
    setAccessError("");
    setAccessMessage("");
    if (inviteRole === "equipe_terrain" && !inviteTeamId) {
      setAccessError("Choisissez l’équipe de ce nouvel intervenant.");
      return;
    }
    setInviteSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-setom-user", {
        body: {
          action: "invite",
          email: inviteEmail.trim(),
          display_name: inviteDisplayName.trim(),
          role: inviteRole,
          team_id: inviteRole === "equipe_terrain" ? inviteTeamId : null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.user) throw new Error("Le serveur n’a pas confirmé l’invitation.");
      setAccessProfiles((profiles) => [...profiles.filter((item) => item.id !== data.user.id), data.user].sort((a,b) => String(a.display_name||a.email).localeCompare(String(b.display_name||b.email), "fr")));
      setInviteEmail("");
      setInviteDisplayName("");
      setAccessMessage(data.message || "Invitation envoyée.");
    } catch (error) {
      setAccessError(error?.message || "Impossible d’envoyer l’invitation.");
    } finally {
      setInviteSaving(false);
    }
  }

  useEffect(() => {
    if (!session || page !== "bpu") return;
    let cancelled = false;
    async function loadBPU() {
      setBpuLoading(true); setBpuError(""); setBpuMessage("");
      try {
        const { data: versions, error: versionsError } = await supabase
          .from("bpu_versions")
          .select("id, version_name, valid_from, valid_to, is_current, imported_at, notes")
          .order("valid_from", { ascending: false });
        if (versionsError) throw versionsError;
        const versionRows = versions || [];
        const current = versionRows.find((version) => version.is_current) || versionRows[0] || null;
        if (cancelled) return;
        setBpuVersions(versionRows);
        if (current) {
          if (!bpuVersionName.trim()) setBpuVersionName(current.version_name + " - révision");
          const defaultDate = current.valid_from ? new Date(current.valid_from + "T12:00:00") : new Date();
          defaultDate.setDate(defaultDate.getDate() + 1);
          setBpuValidFrom((previous) => previous > (current.valid_from || "") ? previous : defaultDate.toISOString().slice(0, 10));
          const { data: lines, error: linesError } = await supabase
            .from("bpu_lines")
            .select("id, version_id, code, designation, unit, unit_price, trade, material, active, price_le_8_m2, price_8_15_m2, price_gt_15_m2")
            .eq("version_id", current.id)
            .order("designation", { ascending: true });
          if (linesError) throw linesError;
          if (!cancelled) setBpuLines((lines || []).map((line) => ({
            ...line,
            code: line.code || "",
            designation: line.designation || "",
            unit: line.unit || "",
            unit_price: line.unit_price == null ? "0" : String(line.unit_price),
            trade: line.trade || "",
            material: line.material || "",
            price_le_8_m2: line.price_le_8_m2 == null ? "" : String(line.price_le_8_m2),
            price_8_15_m2: line.price_8_15_m2 == null ? "" : String(line.price_8_15_m2),
            price_gt_15_m2: line.price_gt_15_m2 == null ? "" : String(line.price_gt_15_m2),
            active: line.active !== false
          })));
        } else {
          setBpuLines([]);
          setBpuError("Aucune version du BPU n'est enregistrée.");
        }
      } catch (error) {
        console.error("Erreur chargement du BPU :", error);
        if (!cancelled) setBpuError(error?.message || "Impossible de charger le bordereau de prix.");
      } finally {
        if (!cancelled) setBpuLoading(false);
      }
    }
    loadBPU();
    return () => { cancelled = true; };
  }, [page, session]);

  function addBpuLine() {
    const current = bpuVersions.find((version) => version.is_current) || bpuVersions[0];
    setBpuLines((lines) => [...lines, { id: "draft-" + Date.now() + "-" + Math.random().toString(36).slice(2), version_id: current?.id || "", code: "", designation: "", unit: "m²", unit_price: "0", trade: "", material: "", active: true, price_le_8_m2: "", price_8_15_m2: "", price_gt_15_m2: "" }]);
    setBpuMessage("Nouvelle ligne ajoutée au brouillon. Elle sera enregistrée uniquement dans la prochaine version.");
    setBpuError("");
  }

  function updateBpuLine(id, field, value) {
    setBpuLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  }

  async function createBpuVersion(event) {
    event.preventDefault();
    setBpuError(""); setBpuMessage("");
    if (bpuSaving) return;
    const current = bpuVersions.find((version) => version.is_current) || bpuVersions[0] || null;
    if (!current) { setBpuError("Aucune version existante à réviser."); return; }
    const name = bpuVersionName.trim();
    if (!name) { setBpuError("Donnez un nom à la nouvelle version du BPU."); return; }
    if (!bpuValidFrom || bpuValidFrom <= (current.valid_from || "")) {
      setBpuError("La nouvelle date de validité doit être postérieure au " + (current.valid_from || "début de contrat") + ".");
      return;
    }
    if (!bpuLines.length) { setBpuError("Le BPU ne contient aucune ligne à enregistrer."); return; }
    for (const line of bpuLines) {
      if (!String(line.designation || "").trim() || !String(line.unit || "").trim()) {
        setBpuError("Chaque ligne doit comporter une désignation et une unité.");
        return;
      }
      for (const field of ["unit_price", "price_le_8_m2", "price_8_15_m2", "price_gt_15_m2"]) {
        const value = String(line[field] ?? "").trim();
        if (value !== "" && (!Number.isFinite(Number(value.replace(",", "."))) || Number(value.replace(",", ".")) < 0)) {
          setBpuError("Les prix doivent être des nombres positifs ou nuls. Vérifiez la ligne « " + line.designation + " ».");
          return;
        }
      }
    }
    if (appSettings?.prices_renegotiable === false && !window.confirm("Les paramètres du marché indiquent que les prix ne sont pas renégociables. Créer quand même une nouvelle version du BPU ? L'action sera historisée.")) return;
    const details = "Créer la version « " + name + " » à partir du " + new Date(bpuValidFrom + "T12:00:00").toLocaleDateString("fr-FR") + " en copiant " + bpuLines.length + " lignes. La version actuelle et ses prix restent conservés dans l'historique.";
    if (!window.confirm(details + "\n\nConfirmer la création ?")) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) { setBpuError("Connexion requise pour enregistrer une version du BPU."); return; }
    setBpuSaving(true);
    try {
      const payload = bpuLines.map((line) => ({
        code: String(line.code || "").trim() || null,
        designation: String(line.designation || "").trim(),
        unit: String(line.unit || "").trim(),
        unit_price: String(line.unit_price ?? "0").trim().replace(",", "."),
        trade: String(line.trade || "").trim() || null,
        material: String(line.material || "").trim() || null,
        active: line.active !== false,
        price_le_8_m2: String(line.price_le_8_m2 ?? "").trim().replace(",", "."),
        price_8_15_m2: String(line.price_8_15_m2 ?? "").trim().replace(",", "."),
        price_gt_15_m2: String(line.price_gt_15_m2 ?? "").trim().replace(",", ".")
      }));
      const { data: result, error } = await supabase.rpc("create_bpu_version_from_current", {
        p_version_name: name,
        p_valid_from: bpuValidFrom,
        p_notes: bpuNotes.trim() || null,
        p_user_id: user.id,
        p_lines: payload
      });
      if (error) throw error;
      if (!result?.version_id || Number(result?.line_count) !== bpuLines.length) {
        throw new Error("La base n'a pas confirmé la création complète de la nouvelle version.");
      }
      setBpuMessage("✅ Version « " + result.version_name + " » enregistrée avec " + result.line_count + " lignes. L'ancienne version est conservée.");
      setBpuVersionName(result.version_name + " - révision");
      setBpuNotes("");
      setBpuLoading(true);
      const { data: versions, error: versionsError } = await supabase.from("bpu_versions").select("id, version_name, valid_from, valid_to, is_current, imported_at, notes").order("valid_from", { ascending: false });
      if (versionsError) throw versionsError;
      const versionRows = versions || [];
      const current = versionRows.find((version) => version.is_current);
      if (!current) throw new Error("Nouvelle version créée mais la version active n'a pas été trouvée à la relecture.");
      const { data: lines, error: linesError } = await supabase.from("bpu_lines").select("id, version_id, code, designation, unit, unit_price, trade, material, active, price_le_8_m2, price_8_15_m2, price_gt_15_m2").eq("version_id", current.id).order("designation", { ascending: true });
      if (linesError) throw linesError;
      setBpuVersions(versionRows);
      setBpuLines((lines || []).map((line) => ({
        ...line,
        code: line.code || "",
        designation: line.designation || "",
        unit: line.unit || "",
        unit_price: line.unit_price == null ? "0" : String(line.unit_price),
        trade: line.trade || "",
        material: line.material || "",
        price_le_8_m2: line.price_le_8_m2 == null ? "" : String(line.price_le_8_m2),
        price_8_15_m2: line.price_8_15_m2 == null ? "" : String(line.price_8_15_m2),
        price_gt_15_m2: line.price_gt_15_m2 == null ? "" : String(line.price_gt_15_m2),
        active: line.active !== false
      })));
      setBpuValidFrom((previous) => {
        const next = current.valid_from ? new Date(current.valid_from + "T12:00:00") : new Date();
        next.setDate(next.getDate() + 1);
        return next.toISOString().slice(0, 10);
      });
    } catch (error) {
      console.error("Erreur création de version BPU :", error);
      setBpuError(error?.message || "Impossible de créer la nouvelle version du BPU.");
    } finally { setBpuSaving(false); setBpuLoading(false); }
  }

  async function saveAppSettings(event) {
    event.preventDefault();
    setSettingsError(""); setSettingsMessage("");
    if (!appSettings?.id) { setSettingsError("Paramètres indisponibles. Rechargez l'application."); return; }
    const companyName = String(appSettings.company_name || "").trim();
    const donorName = String(appSettings.donor_name || "").trim();
    const validatorName = String(appSettings.validator_name || "").trim();
    const osLabel = String(appSettings.os_label || "").trim();
    const delay = Number(appSettings.standard_delay_days);
    const capacity = Number(appSettings.enrobee_reference_capacity_m2);
    const duration = Number(appSettings.contract_duration_years);
    if (!companyName || !donorName || !validatorName || !osLabel) { setSettingsError("Renseignez le nom de l'application, le donneur d'ordre, le validateur et le libellé OS."); return; }
    if (!Number.isInteger(delay) || delay < 1 || delay > 365) { setSettingsError("Le délai avant échéance doit être un nombre entier entre 1 et 365 jours."); return; }
    if (!Number.isFinite(capacity) || capacity <= 0) { setSettingsError("La capacité de référence doit être supérieure à zéro."); return; }
    if (!Number.isInteger(duration) || duration < 1 || duration > 20) { setSettingsError("La durée du marché doit être comprise entre 1 et 20 ans."); return; }
    setSettingsSaving(true);
    try {
      const payload = { company_name: companyName, donor_name: donorName, validator_name: validatorName, os_label: osLabel, standard_delay_days: delay, enrobee_reference_capacity_m2: capacity, contract_duration_years: duration, prices_renegotiable: !!appSettings.prices_renegotiable, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("app_settings").update(payload).eq("id", appSettings.id).select("id, company_name, donor_name, validator_name, os_label, standard_delay_days, enrobee_reference_capacity_m2, contract_duration_years, prices_renegotiable").single();
      if (error) throw error;
      setAppSettings(data);
      setSettingsMessage("Paramètres enregistrés. Le délai mis à jour s'appliquera aux nouveaux OS ; les échéances existantes restent inchangées.");
      window.dispatchEvent(new Event("setom:planning-updated"));
    } catch (error) {
      console.error("Erreur enregistrement paramètres :", error);
      setSettingsError(error?.message || "Impossible d'enregistrer les paramètres. Vérifiez vos droits d'administration.");
    } finally { setSettingsSaving(false); }
  }

  async function saveMaterialCatalogItem(material) {
    setMaterialsError(""); setMaterialsMessage("");
    if (!String(material.name || "").trim() || !String(material.category || "").trim()) { setMaterialsError("Chaque matériau doit avoir un nom et une catégorie."); return; }
    const difficulty = Number(String(material.planning_difficulty || "1").replace(",", "."));
    const capacity = String(material.indicative_capacity_m2 ?? "").trim() === "" ? null : Number(String(material.indicative_capacity_m2).replace(",", "."));
    const order = Number(material.sort_order);
    if (!Number.isFinite(difficulty) || difficulty <= 0) { setMaterialsError("La difficulté de planification doit être supérieure à zéro."); return; }
    if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) { setMaterialsError("La capacité indicative doit être supérieure à zéro ou vide."); return; }
    if (!Number.isInteger(order) || order < 0) { setMaterialsError("L'ordre d'affichage doit être un entier positif ou nul."); return; }
    setMaterialSaveIds((current) => current.includes(material.id) ? current : [...current, material.id]);
    try {
      const payload = { name: String(material.name).trim(), category: String(material.category).trim(), planning_difficulty: difficulty, indicative_capacity_m2: capacity, sort_order: order, active: !!material.active };
      const { data, error } = await supabase.from("materials").update(payload).eq("id", material.id).select("id, name, category, active, planning_difficulty, indicative_capacity_m2, sort_order").single();
      if (error) throw error;
      setDbMaterials((current) => current.map((item) => item.id === material.id ? { ...data, planning_difficulty: String(data.planning_difficulty ?? "1"), indicative_capacity_m2: data.indicative_capacity_m2 == null ? "" : String(data.indicative_capacity_m2), sort_order: String(data.sort_order ?? "0") } : item));
      setMaterialsMessage("✅ Matériau « " + data.name + " » enregistré.");
      window.dispatchEvent(new Event("setom:planning-updated"));
    } catch (error) {
      console.error("Erreur enregistrement matériau :", error);
      setMaterialsError(error?.message || "Impossible d'enregistrer ce matériau. La modification nécessite le rôle administrateur.");
    } finally { setMaterialSaveIds((current) => current.filter((id) => id !== material.id)); }
  }

  async function handleCreateTeam(event) {
    event.preventDefault();
    setTeamError("");
    const name = newTeamName.trim();
    const capacity = newTeamCapacity.trim() === "" ? null : Number(newTeamCapacity.replace(",", "."));
    if (!name) { setTeamError("Le nom de l'équipe est obligatoire."); return; }
    if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) { setTeamError("La capacité doit être un nombre positif (m²/jour)."); return; }
    setTeamSaving(true);
    try {
      const { data, error } = await supabase.from("teams").insert({ name, team_type: newTeamType, usual_sector_id: newTeamSectorId || null, indicative_capacity: capacity, active: true }).select("id, name, team_type, usual_sector_id, indicative_capacity, active").single();
      if (error) throw error;
      setDbTeams((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name, "fr")));
      setNewTeamName(""); setNewTeamType("interne"); setNewTeamCapacity(""); setNewTeamSectorId("");
      window.dispatchEvent(new Event("setom:planning-updated"));
    } catch (error) {
      console.error("Erreur création équipe :", error);
      setTeamError(error?.message || "Impossible de créer l'équipe. Vérifiez vos droits d'administration.");
    } finally { setTeamSaving(false); }
  }

  async function toggleTeamActive(team) {
    setTeamError(""); setTeamSaving(true);
    try {
      const nextActive = !team.active;
      const { error } = await supabase.from("teams").update({ active: nextActive }).eq("id", team.id);
      if (error) throw error;
      setDbTeams((current) => current.map((item) => item.id === team.id ? { ...item, active: nextActive } : item));
      window.dispatchEvent(new Event("setom:planning-updated"));
    } catch (error) {
      console.error("Erreur modification équipe :", error);
      setTeamError(error?.message || "Impossible de modifier l'équipe.");
    } finally { setTeamSaving(false); }
  }

  async function handleCreateOS(event) {
    event.preventDefault(); setNewOSError(""); setNewOSSaving(true);
    if (!newOSAddress.trim()) { setNewOSError("L'adresse est obligatoire."); setNewOSSaving(false); return; }
    if (!newOSMaterial) { setNewOSError("Veuillez sélectionner un matériau."); setNewOSSaving(false); return; }
    if (!newOSSectorId) { setNewOSError("Veuillez classer l'OS dans un secteur."); setNewOSSaving(false); return; }
    const parseSurface = (value) => value.trim() === "" ? null : Number(value.replace(",", "."));
    const genericSurface = parseSurface(newOSSurface), roadSurface = parseSurface(newOSRoadSurface), sidewalkSurface = parseSurface(newOSSidewalkSurface);
    if ([genericSurface, roadSurface, sidewalkSurface].some((value) => value !== null && isNaN(value))) { setNewOSError("Les surfaces doivent être des nombres."); setNewOSSaving(false); return; }
    if (!newOSRehabilitationZone) { setNewOSError("Veuillez sélectionner la zone de réfection."); setNewOSSaving(false); return; }
    if (newOSRehabilitationZone === "Autre" && !newOSRehabilitationOtherDetail.trim()) { setNewOSError("Veuillez préciser la zone de réfection."); setNewOSSaving(false); return; }
    const surface = newOSRehabilitationZone === "Chaussée" ? roadSurface : newOSRehabilitationZone === "Trottoir" ? sidewalkSurface : newOSRehabilitationZone === "Chaussée + trottoir" ? (roadSurface || 0) + (sidewalkSurface || 0) : genericSurface;
    const { data, error } = await supabase.from("work_orders").insert({
      status: "À planifier", address: newOSAddress.trim(), postal_code: newOSPostalCode.trim() || null, city: newOSCity.trim() || null, sector_id: newOSSectorId,
      material_detail: newOSMaterialDetail.trim() || newOSMaterial, rehabilitation_zone: newOSRehabilitationZone,
      rehabilitation_other_detail: newOSRehabilitationOtherDetail.trim() || null, planned_road_surface_m2: roadSurface,
      planned_sidewalk_surface_m2: sidewalkSurface, planned_surface_m2: surface, particularities: newOSParticularities.trim() || null,
      created_by: session.user.id, updated_by: session.user.id,
    }).select("*").single();
    if (error) { console.error("Erreur création OS :", error); setNewOSError("Impossible de créer l'OS : " + error.message); setNewOSSaving(false); return; }
    for (const file of newOSFiles) {
      try {
        const safeFileName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `work-orders/${data.id}/${Date.now()}-${safeFileName}`;
        const { error: uploadError } = await supabase.storage.from("setom-files").upload(storagePath, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const category = file.type.startsWith("image/") ? "photo" : "document";
        const { error: attachmentError } = await supabase.from("attachments").insert({ work_order_id: data.id, category, file_name: file.name, storage_path: storagePath, mime_type: file.type || null, captured_at: new Date().toISOString(), created_by: session.user.id });
        if (attachmentError) throw attachmentError;
      } catch (fileError) {
        console.error("Erreur upload fichier :", file.name, fileError);
        setNewOSError(`L'OS a été créé, mais le fichier "${file.name}" n'a pas pu être enregistré.`); setNewOSSaving(false); return;
      }
    }
    const formattedOS = {
      id: `${String(appSettings?.os_label || "OS").trim()}-${new Date(data.creation_date).getFullYear()}-${String(data.os_number).padStart(5, "0")}`, dbId: data.id,
      address: `${data.address || ""}${data.city ? `, ${data.city}` : ""}`, work: data.material_detail || "Intervention", day: null,
      team: "Non affectée", trade: data.material_detail || "Intervention", sector: dbSectors.find((sector) => sector.id === data.sector_id)?.name || "Non classé", sectorId: data.sector_id || "", status: data.status || "À planifier",
      quantity: data.planned_surface_m2 ? `${data.planned_surface_m2} m²` : "", intervention: data.material_detail || "Intervention",
      rehabilitationZone: data.rehabilitation_zone, rehabilitationOtherDetail: data.rehabilitation_other_detail,
      roadSurface: data.planned_road_surface_m2, sidewalkSurface: data.planned_sidewalk_surface_m2,
      actualRoadSurface: data.actual_road_surface_m2, actualSidewalkSurface: data.actual_sidewalk_surface_m2, actualOtherSurface: data.actual_other_surface_m2,
      deadline: data.deadline_date, isNight: !!data.is_night, problemSuspended: !!data.problem_suspended,
      suspensionReason: data.suspension_reason || "", suspensionComment: data.suspension_comment || "", suspensionStartedAt: data.suspension_started_at || null, suspensionRestartedAt: data.suspension_restarted_at || null,
    };
    setOsList((current) => [formattedOS, ...current]); setShowNewOS(false);
    setNewOSAddress(""); setNewOSPostalCode(""); setNewOSCity(""); setNewOSSectorId(""); setNewOSMaterial(""); setNewOSMaterialDetail(""); setNewOSSurface("");
    setNewOSRehabilitationZone(""); setNewOSRehabilitationOtherDetail(""); setNewOSRoadSurface(""); setNewOSSidewalkSurface(""); setNewOSParticularities(""); setNewOSFiles([]); setNewOSError(""); setNewOSSaving(false);
  }

  if (authLoading) return <div style={{ padding: "40px", textAlign: "center" }}><h1>SETOM</h1><p>Chargement...</p></div>;
  if (!session) return <div style={{ padding: "40px", maxWidth: "400px", margin: "auto" }}><h1>SETOM</h1><p>Connexion à votre espace de gestion</p><form onSubmit={handleLogin}><input type="email" placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box" }} /><input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box" }} />{authError && <p style={{ color: "red" }}>{authError}</p>}<button type="submit">Se connecter</button></form></div>;
  if (profileLoading || !currentProfile) return <div style={{ padding: 40, maxWidth: 520, margin: "auto", textAlign: "center" }}><h1>SETOM</h1><p>{profileError ? "Accès indisponible" : "Vérification des droits…"}</p>{profileError && <p style={{ color: "#b42318" }}>{profileError}</p>}<button className="secondary" type="button" onClick={handleLogout}>Se déconnecter</button></div>;
  if (currentProfile.must_set_password) return <div style={{ padding: 24, maxWidth: 480, margin: "40px auto" }}><h1>SETOM</h1><h2>Activer votre compte</h2><p>Pour terminer l’activation de votre compte, choisissez un mot de passe personnel.</p><form onSubmit={finishPasswordSetup} className="card" style={{ display: "grid", gap: 12 }}><label>Nouveau mot de passe<input type="password" value={passwordSetup} onChange={(e) => setPasswordSetup(e.target.value)} minLength={8} autoComplete="new-password" required style={{ width: "100%", boxSizing: "border-box" }}/></label><label>Confirmer le mot de passe<input type="password" value={passwordSetupConfirm} onChange={(e) => setPasswordSetupConfirm(e.target.value)} minLength={8} autoComplete="new-password" required style={{ width: "100%", boxSizing: "border-box" }}/></label>{passwordSetupError && <p style={{ color: "#b42318" }}>{passwordSetupError}</p>}<button className="primary" type="submit" disabled={passwordSetupSaving}>{passwordSetupSaving ? "Enregistrement…" : "Activer mon compte"}</button></form></div>;

  const filteredOS = osList.filter((os) => {
    const text = `${os.id} ${os.address} ${os.work} ${os.sector}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (statusFilter === "Tous" || os.status === statusFilter) && (teamFilter === "Toutes" || os.team === teamFilter) && (sectorFilter === "Tous" || os.sector === sectorFilter);
  });
  const teams = [...new Set([...osList.map((os) => os.team), ...dbTeams.map((team) => team.name)])].filter(Boolean);
  function updateOS(id, changes) {
    setOsList((current) => current.map((os) => os.id === id ? { ...os, ...changes } : os));
    setSelectedOS((current) => current && current.id === id ? { ...current, ...changes } : current);
  }
  const activeStatuses = new Set(["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur", "Travaux réalisés", "Constat à vérifier", "Constat validé", "Travaux effectués", "Constat de facturation", "En attente de validation", "Validé", "Validé avec réserve", "Réserve", "Correction à réaliser", "Payé"]);
  const currentWeekday = new Date().toLocaleDateString("fr-FR", { weekday: "long" });
  const currentDayName = currentWeekday.charAt(0).toUpperCase() + currentWeekday.slice(1);
  const stats = {
    total: osList.filter((o) => activeStatuses.has(o.status)).length,
    planning: osList.filter((o) => o.status === "À planifier").length,
    today: osList.filter((o) => o.day === currentDayName).length,
    travaux: osList.filter((o) => o.status === "En travaux" || o.status === "Travaux en cours" || o.status === "Travaux réalisés").length,
    facturation: osList.filter((o) => (o.status === "Travaux effectués" || o.status === "Constat de facturation") && !(o.constatStatus === "Validé avec réserve" && !o.reserveResolvedAt)).length,
    validation: osList.filter((o) => o.status === "En attente de validation" || o.status === "Constat à vérifier" || o.status === "Constat validé").length,
    reserves: osList.filter((o) => o.status === "Réserve" || o.status === "Correction à réaliser" || (o.constatStatus === "Validé avec réserve" && !o.reserveResolvedAt)).length,
    errors: osList.filter((o) => o.status === "En erreur").length,
  };

  return <div className="app">
    <header className="header"><div><h1>{appSettings?.company_name || "SETOM"}</h1><small>Gestion des travaux routiers</small></div><div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><small>{currentProfile.display_name || currentProfile.email} · {ROLE_LABELS[currentProfile.role] || "Accès limité"}</small><button type="button" className="secondary" onClick={handleLogout}>Se déconnecter</button></div></header>
    <main className="container">
      <nav className="nav">
        {[["dashboard","📊 Tableau de bord"],["os","📋 OS"],["map","🗺️ Carte"],["planning","📅 Planning"],["teams","👷 Équipes"],["reserves","⚠️ Réserves"],["bpu","💶 Bordereau de prix"],["materials","🧱 Matériaux"],["settings","⚙️ Paramètres"],["access","🔐 Accès"]].filter(([id]) => {
          const role = currentProfile?.role;
          if (role === "admin") return true;
          if (role === "bureau") return ["dashboard","os","map","planning","reserves"].includes(id);
          if (role === "equipe_terrain") return ["dashboard","os","planning"].includes(id);
          if (role === "eau_de_toulouse") return ["dashboard","os","reserves"].includes(id);
          return false;
        }).map(([id,label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>{label}</button>)}
      </nav>
      {page === "dashboard" && <><h2>Tableau de bord</h2><div className="cards"><div className="card"><div>OS actifs</div><div className="number">{stats.total}</div></div><div className="card"><div>À planifier</div><div className="number">{stats.planning}</div></div><div className="card"><div>Travaux en cours</div><div className="number">{stats.travaux}</div></div><div className="card"><div>À facturer</div><div className="number">{stats.facturation}</div></div><div className="card"><div>Validation</div><div className="number">{stats.validation}</div></div><div className="card"><div>Réserves</div><div className="number">{stats.reserves}</div></div><div className="card"><div>OS en erreur</div><div className="number">{stats.errors}</div></div></div><h2>OS récents</h2><div className="os-list">{osList.slice(0,5).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}</div></>}
      {page === "os" && <>
        {showNewOS && <div className="modal-overlay"><div className="modal"><div className="modal-header"><h2>Nouvel ordre de service</h2><button className="secondary" type="button" onClick={() => setShowNewOS(false)}>✕</button></div><form onSubmit={handleCreateOS}>
          <label>Adresse *</label><input type="text" value={newOSAddress} onChange={(e) => setNewOSAddress(e.target.value)} placeholder="Ex. 12 rue de la République" required />
          <label>Code postal</label><input type="text" value={newOSPostalCode} onChange={(e) => setNewOSPostalCode(e.target.value)} placeholder="Ex. 82000" />
          <label>Ville</label><input type="text" value={newOSCity} onChange={(e) => setNewOSCity(e.target.value)} placeholder="Ex. Montauban" />
          <label>Secteur *</label><select value={newOSSectorId} onChange={(e) => setNewOSSectorId(e.target.value)} required><option value="">Choisir un secteur…</option>{dbSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select>
          <div className="material-section"><label>Matériau *</label><div className="material-cards">{[...new Set(dbMaterials.filter((item) => item.active).map((item) => item.category))].map((category) => ({ value: category, icon: category.toLocaleLowerCase("fr-FR").includes("béton") ? "🧱" : category.toLocaleLowerCase("fr-FR").includes("enrob") ? "🛣️" : category.toLocaleLowerCase("fr-FR").includes("asphalte") ? "⬛" : "⛰️" })).map((material) => <button key={material.value} type="button" className={`material-card ${newOSMaterial === material.value ? "selected" : ""}`} onClick={() => {setNewOSMaterial(material.value);setNewOSMaterialDetail("");}}><span className="material-icon">{material.icon}</span><span>{material.value}</span></button>)}</div></div>
          {dbMaterials.filter((item) => item.active && item.category === newOSMaterial).length > 1 && <div className="material-subtypes"><label>Variantes de {newOSMaterial.toLocaleLowerCase("fr-FR")}</label><div className="material-subtype-grid">{dbMaterials.filter((item) => item.active && item.category === newOSMaterial).map((item) => <button key={item.id} type="button" className={`material-subtype-button ${newOSMaterialDetail === item.name ? "selected" : ""}`} onClick={() => setNewOSMaterialDetail(item.name)}>{item.name}</button>)}</div></div>}
          
          <label>Détail du matériau</label><input type="text" value={newOSMaterialDetail} onChange={(e) => setNewOSMaterialDetail(e.target.value)} placeholder="Ex. Enrobé 0/10 noir" />
          <div className="rehabilitation-section"><label>Zone de réfection *</label><div className="rehabilitation-cards">{["Chaussée","Trottoir","Chaussée + trottoir","Autre"].map((zone) => <button key={zone} type="button" className={`rehabilitation-card ${newOSRehabilitationZone === zone ? "selected" : ""}`} onClick={() => {setNewOSRehabilitationZone(zone);if(zone!=="Autre")setNewOSRehabilitationOtherDetail("");if(zone==="Chaussée")setNewOSSidewalkSurface("");if(zone==="Trottoir")setNewOSRoadSurface("");}}>{zone}</button>)}</div>
            {newOSRehabilitationZone === "Chaussée" && <div className="rehabilitation-surface-field"><label>Surface chaussée prévue (m²)</label><input type="number" step="0.01" min="0" value={newOSRoadSurface} onChange={(e) => setNewOSRoadSurface(e.target.value)} placeholder="Ex. 12.5" /></div>}
            {newOSRehabilitationZone === "Trottoir" && <div className="rehabilitation-surface-field"><label>Surface trottoir prévue (m²)</label><input type="number" step="0.01" min="0" value={newOSSidewalkSurface} onChange={(e) => setNewOSSidewalkSurface(e.target.value)} placeholder="Ex. 8.5" /></div>}
            {newOSRehabilitationZone === "Chaussée + trottoir" && <div className="rehabilitation-surface-grid"><div><label>Surface chaussée (m²)</label><input type="number" step="0.01" min="0" value={newOSRoadSurface} onChange={(e) => setNewOSRoadSurface(e.target.value)} placeholder="Ex. 12.5" /></div><div><label>Surface trottoir (m²)</label><input type="number" step="0.01" min="0" value={newOSSidewalkSurface} onChange={(e) => setNewOSSidewalkSurface(e.target.value)} placeholder="Ex. 6.5" /></div></div>}
            {newOSRehabilitationZone === "Autre" && <><label>Précision</label><input type="text" value={newOSRehabilitationOtherDetail} onChange={(e) => setNewOSRehabilitationOtherDetail(e.target.value)} placeholder="Préciser la zone de réfection" /><label>Surface prévue (m²)</label><input type="number" step="0.01" min="0" value={newOSSurface} onChange={(e) => setNewOSSurface(e.target.value)} placeholder="Ex. 12.5" /></>}
          </div>
          <label>Particularités</label><textarea value={newOSParticularities} onChange={(e) => setNewOSParticularities(e.target.value)} placeholder="Informations particulières concernant l'intervention..." rows="4" />
          <div className="attachments-section"><label>📎 Photos et documents</label><div className="attachments-buttons"><label className="attachment-button">📷 Prendre une photo<input type="file" accept="image/*" capture="environment" multiple onChange={(e) => {const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setNewOSFiles((current)=>[...current,...files]);e.target.value="";}} /></label><label className="attachment-button">🖼️ Choisir une image dans Photos ou Fichiers<input type="file" accept="image/*" multiple onChange={(e) => {const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setNewOSFiles((current)=>[...current,...files]);e.target.value="";}} /></label><label className="attachment-button">📄 Ajouter un document<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple onChange={(e)=>{const files=Array.from(e.target.files||[]);setNewOSFiles((current)=>[...current,...files]);e.target.value="";}} /></label></div>{newOSFiles.length>0&&<div className="attachments-list">{newOSFiles.map((file,index)=><div className="attachment-item" key={file.name+"-"+index}>{file.type.startsWith("image/")&&<LocalImagePreview file={file}/>}<span>{file.type.startsWith("image/")?"🖼️":"📄"} {file.name}</span><button type="button" aria-label={"Retirer "+file.name} onClick={()=>setNewOSFiles((current)=>current.filter((_,i)=>i!==index))}>×</button></div>)}</div>}</div>
          {newOSError && <p style={{color:"red",marginTop:10}}>{newOSError}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowNewOS(false)}>Annuler</button><button type="submit" className="primary" disabled={newOSSaving}>{newOSSaving?"Enregistrement...":"Créer l'OS"}</button></div>
        </form></div></div>}
        <h2>Ordres de service</h2><div className="toolbar">{["admin","bureau"].includes(currentProfile?.role) && <button className="primary" onClick={()=>{setNewOSError("");setShowNewOS(true);}}>+ Nouveau OS</button>}<input placeholder="🔎 Rechercher OS, adresse..." value={search} onChange={(e)=>setSearch(e.target.value)}/><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option>Tous</option>{statuses.map((status)=><option key={status}>{status}</option>)}</select><select value={teamFilter} onChange={(e)=>setTeamFilter(e.target.value)}><option>Toutes</option>{teams.map((team)=><option key={team}>{team}</option>)}</select><select value={sectorFilter} onChange={(e)=>setSectorFilter(e.target.value)}><option value="Tous">Tous les secteurs</option>{dbSectors.map((sector)=><option key={sector.id} value={sector.name}>{sector.name}</option>)}<option value="Non classé">Non classés</option></select></div><StatusLegend /><div className="os-list">{filteredOS.map((os)=><OSCard key={os.id} os={os} onOpen={()=>setSelectedOS(os)}/>)}</div>
      </>}
      {page === "map" && <><h2>Carte des interventions</h2><StatusLegend compact /><div className="toolbar"><button className="secondary">Tous</button><button className="secondary">OS non planifiés</button><button className="secondary">Réserves</button><button className="secondary">À facturer</button></div><div className="map"><div className="map-road"></div>{osList.map((os,index)=>{const positions=[[20,25],[48,18],[72,35],[30,60],[65,68],[82,20]];const [left,top]=positions[index%positions.length];return <button key={os.id} className="marker" title={os.id} onClick={()=>setSelectedOS(os)} style={{left:`${left}%`,top:`${top}%`,background:getOSStatusColors(os.status).accent}}><span>•</span></button>;})}</div></>}
      {page === "planning" && <><h2>Planning hebdomadaire</h2><StatusLegend compact /><div className="planning"><div className="week">{days.slice(0,5).map((day)=><div className="day" key={day.name}><div className="day-header" style={{background:day.color}}>{day.name}</div>{osList.filter((os)=>os.day===day.name).map((os)=><div className="planning-os" key={os.id} style={{ borderLeft: "4px solid " + getOSStatusColors(os.status).accent, background: getOSStatusColors(os.status).background }} onClick={()=>setSelectedOS(os)}><strong>{os.id}</strong><br/>{os.address}<br/><small>{os.team}</small><div className="setom-status-chip" style={getOSStatusBadgeStyle(os.status)}>{os.status}</div></div>)}</div>)}</div></div><h3>OS non planifiés</h3><div className="os-list">{osList.filter((os)=>!os.day).map((os)=><OSCard key={os.id} os={os} onOpen={()=>setSelectedOS(os)}/>)}</div></>}
      {page === "teams" && <><h2>Gestion des équipes</h2>
        <form onSubmit={handleCreateTeam} className="card" style={{ marginBottom: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, alignItems: "end" }}>
          <div><label htmlFor="new-team-name">Nom de l'équipe *</label><input id="new-team-name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Ex. Équipe 1" required style={{ width: "100%", boxSizing: "border-box" }}/></div>
          <div><label htmlFor="new-team-type">Type</label><select id="new-team-type" value={newTeamType} onChange={(e) => setNewTeamType(e.target.value)} style={{ width: "100%" }}><option value="interne">Équipe interne</option><option value="sous-traitant">Sous-traitant</option></select></div>
          <div><label htmlFor="new-team-sector">Secteur habituel</label><select id="new-team-sector" value={newTeamSectorId} onChange={(e) => setNewTeamSectorId(e.target.value)} style={{ width: "100%" }}><option value="">Aucun secteur fixe</option>{dbSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>
          <div><label htmlFor="new-team-capacity">Capacité indicative (m²/jour)</label><input id="new-team-capacity" type="number" min="0.1" step="0.1" value={newTeamCapacity} onChange={(e) => setNewTeamCapacity(e.target.value)} placeholder="Facultatif" style={{ width: "100%", boxSizing: "border-box" }}/></div>
          <button className="primary" type="submit" disabled={teamSaving}>{teamSaving ? "Enregistrement…" : "＋ Ajouter l'équipe"}</button>
          {teamError && <div style={{ gridColumn: "1 / -1", color: "#b42318", fontSize: 13 }}>{teamError}</div>}
        </form>
        {dbTeams.length === 0 ? <div className="card"><strong>Aucune équipe enregistrée</strong><p>Ajoutez vos équipes ici pour pouvoir les affecter aux OS dans le planning.</p></div> : <div className="cards">{dbTeams.map((team) => { const count = osList.filter((os) => os.teamId === team.id).length; return <div className="card" key={team.id} style={{ opacity: team.active ? 1 : .65 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}><strong>👷 {team.name}</strong><span className="badge">{team.active ? "Active" : "Inactive"}</span></div><div>{team.team_type === "sous-traitant" ? "Sous-traitant" : "Équipe interne"}</div>{team.usual_sector_id && <div style={{ color: "#475467", fontSize: 13 }}>Secteur habituel : {dbSectors.find((sector) => sector.id === team.usual_sector_id)?.name || "Secteur inactif"}</div>}<div className="number">{count}</div><div>OS affecté{count === 1 ? "" : "s"}</div>{team.indicative_capacity && <div style={{ marginTop: 8, color: "#667085", fontSize: 13 }}>Capacité indicative : {team.indicative_capacity} m²/jour</div>}<button className="secondary" disabled={teamSaving} style={{ marginTop: 12 }} onClick={() => toggleTeamActive(team)}>{team.active ? "Désactiver" : "Réactiver"}</button></div>; })}</div>}
      </>}
      {page === "reserves" && <><h2>Réserves et corrections</h2><div className="os-list">{osList.filter((os)=>os.status==="Réserve"||os.status==="Correction à réaliser"||(os.constatStatus==="Validé avec réserve"&&!os.reserveResolvedAt)).map((os)=><OSCard key={os.id} os={os} onOpen={()=>setSelectedOS(os)}/>)}{osList.filter((os)=>os.status==="Réserve"||os.status==="Correction à réaliser"||(os.constatStatus==="Validé avec réserve"&&!os.reserveResolvedAt)).length===0&&<div className="card">Aucune réserve en cours.</div>}</div></>}{page === "bpu" && <><h2>Bordereau de prix (BPU)</h2>
        <p style={{ color: "#667085", marginTop: -6 }}>Modifier les prix, puis créer une nouvelle version datée. Les constats déjà émis conservent leurs prix enregistrés.</p>
        {bpuVersions.length > 0 && <div className="cards" style={{ marginBottom: 16 }}>{bpuVersions.map((version) => <div className="card" key={version.id} style={{ border: version.is_current ? "2px solid #175cd3" : "1px solid #e4e7ec" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}><strong>{version.version_name}</strong><span className="badge">{version.is_current ? "En vigueur" : "Historique"}</span></div><div style={{ fontSize: 13, marginTop: 8 }}>Valide du {version.valid_from ? new Date(version.valid_from + "T12:00:00").toLocaleDateString("fr-FR") : "—"}{version.valid_to ? " au " + new Date(version.valid_to + "T12:00:00").toLocaleDateString("fr-FR") : version.is_current ? " · sans date de fin" : ""}</div>{version.notes && <p style={{ fontSize: 12, color: "#667085" }}>{version.notes}</p>}</div>)}</div>}
        {bpuLoading && <div className="card">Chargement du BPU…</div>}
        {bpuError && <div className="card" style={{ color: "#b42318", marginBottom: 12 }}>{bpuError}</div>}
        {bpuMessage && <div className="card" style={{ color: "#027a48", marginBottom: 12 }}>{bpuMessage}</div>}
        {!bpuLoading && bpuLines.length > 0 && <><div className="card" style={{ marginBottom: 12 }}><strong>{bpuLines.length} lignes · version actuelle : {(bpuVersions.find((version) => version.is_current) || bpuVersions[0])?.version_name}</strong><p style={{ marginBottom: 0, fontSize: 13, color: "#667085" }}>Les modifications restent en brouillon dans cet écran. Elles ne sont appliquées qu'après confirmation et création d'une nouvelle version.</p></div>
          <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 10, borderBottom: "1px solid #e4e7ec" }}><span style={{ fontSize: 12, color: "#667085" }}>Les ajouts et retraits ne seront enregistrés qu'avec la prochaine version.</span><button type="button" className="secondary" disabled={bpuSaving} onClick={addBpuLine}>＋ Ajouter une ligne</button></div><div style={{ overflowX: "auto", maxHeight: "58vh" }}><table style={{ width: "100%", minWidth: 1220, borderCollapse: "collapse", fontSize: 12 }}><thead style={{ position: "sticky", top: 0, zIndex: 1, background: "#f8fafc" }}><tr>{["Code","Désignation","Unité","Prix unitaire (€)","≤ 8 m² (€)","8–15 m² (€)","> 15 m² (€)","Lot / corps d'état","Matériau","Actif","Actions"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 9, borderBottom: "1px solid #e4e7ec", whiteSpace: "nowrap" }}>{heading}</th>)}</tr></thead><tbody>{bpuLines.map((line) => <tr key={line.id} style={{ opacity: line.active ? 1 : .55 }}><td style={{ padding: 6, borderBottom: "1px solid #edf0f4" }}><input aria-label={"Code " + line.designation} value={line.code} onChange={(e) => updateBpuLine(line.id,"code",e.target.value)} style={{ width: 85 }} /></td><td style={{ padding: 6, borderBottom: "1px solid #edf0f4" }}><input aria-label={"Désignation " + line.designation} value={line.designation} onChange={(e) => updateBpuLine(line.id,"designation",e.target.value)} style={{ width: 260 }} /></td><td style={{ padding: 6, borderBottom: "1px solid #edf0f4" }}><input aria-label={"Unité " + line.designation} value={line.unit} onChange={(e) => updateBpuLine(line.id,"unit",e.target.value)} style={{ width: 70 }} /></td>
          {[["unit_price","Prix unitaire"],["price_le_8_m2","Prix jusqu'à 8 m²"],["price_8_15_m2","Prix de 8 à 15 m²"],["price_gt_15_m2","Prix au-delà de 15 m²"]].map(([field,label]) => <td key={field} style={{ padding: 6, borderBottom: "1px solid #edf0f4" }}><input aria-label={label + " — " + line.designation} type="number" min="0" step="0.0001" value={line[field]} onChange={(e) => updateBpuLine(line.id,field,e.target.value)} style={{ width: 108 }} /></td>)}
          <td style={{ padding: 6, borderBottom: "1px solid #edf0f4" }}><input aria-label={"Lot " + line.designation} value={line.trade} onChange={(e) => updateBpuLine(line.id,"trade",e.target.value)} style={{ width: 130 }} /></td><td style={{ padding: 6, borderBottom: "1px solid #edf0f4" }}><input aria-label={"Matériau " + line.designation} value={line.material} onChange={(e) => updateBpuLine(line.id,"material",e.target.value)} style={{ width: 130 }} /></td><td style={{ padding: 6, borderBottom: "1px solid #edf0f4", textAlign: "center" }}><input aria-label={"Ligne active " + line.designation} type="checkbox" checked={line.active} onChange={(e) => updateBpuLine(line.id,"active",e.target.checked)} /></td><td style={{ padding: 6, borderBottom: "1px solid #edf0f4" }}><button type="button" className="secondary" disabled={bpuSaving} onClick={() => { setBpuLines((current) => current.filter((item) => item.id !== line.id)); setBpuMessage("Ligne retirée du brouillon uniquement. La version active n'est pas modifiée."); setBpuError(""); }}>Retirer</button></td></tr>)}</tbody></table></div></div>
          <form className="card" onSubmit={createBpuVersion} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, alignItems: "end" }}>
            <div><label htmlFor="bpu-version-name">Nom de la nouvelle version *</label><input id="bpu-version-name" value={bpuVersionName} onChange={(e) => setBpuVersionName(e.target.value)} required style={{ width: "100%", boxSizing: "border-box" }} /></div>
            <div><label htmlFor="bpu-valid-from">Valide à partir du *</label><input id="bpu-valid-from" type="date" value={bpuValidFrom} min={(bpuVersions.find((version) => version.is_current) || bpuVersions[0])?.valid_from ? new Date(new Date((bpuVersions.find((version) => version.is_current) || bpuVersions[0]).valid_from + "T12:00:00").getTime()+86400000).toISOString().slice(0,10) : undefined} onChange={(e) => setBpuValidFrom(e.target.value)} required style={{ width: "100%", boxSizing: "border-box" }} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label htmlFor="bpu-notes">Notes de version / motif de modification</label><textarea id="bpu-notes" rows={2} value={bpuNotes} onChange={(e) => setBpuNotes(e.target.value)} placeholder="Ex. renégociation annuelle, révision de tarifs…" style={{ width: "100%", boxSizing: "border-box" }} /></div>
            <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}><button className="primary" type="submit" disabled={bpuSaving || bpuLoading}>{bpuSaving ? "Création de la version…" : "💾 Créer une nouvelle version et appliquer ces prix"}</button><button className="secondary" type="button" disabled={bpuSaving || bpuLoading} onClick={() => { const current = bpuVersions.find((version) => version.is_current) || bpuVersions[0]; if (!current) return; setBpuLines((lines) => [...lines].sort((a,b) => String(a.designation).localeCompare(String(b.designation),"fr"))); setBpuError(""); setBpuMessage("Ordre des lignes remis par désignation. Les changements de tarifs sont toujours en brouillon."); }}>Trier par désignation</button></div>
          </form>
        </>}
      </>}{page === "materials" && <><h2>Catalogue des matériaux</h2>
        <p style={{ color: "#667085", marginTop: -6 }}>Le catalogue pilote les choix du formulaire de nouvel OS. La capacité indicative et le coefficient de difficulté servent de paramètres de planification ; laissez la capacité vide si elle n'est pas définie.</p>
        {materialsError && <div className="card" style={{ color: "#b42318", marginBottom: 12 }}>{materialsError}</div>}
        {materialsMessage && <div className="card" style={{ color: "#027a48", marginBottom: 12 }}>{materialsMessage}</div>}
        <div className="cards" style={{ marginBottom: 12 }}><div className="card"><strong>{dbMaterials.length}</strong><div>Matériaux enregistrés</div></div><div className="card"><strong>{dbMaterials.filter((item) => item.active).length}</strong><div>Actifs dans les nouveaux OS</div></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          {dbMaterials.map((material) => <div className="card" key={material.id} style={{ border: "1px solid #e4e7ec", opacity: material.active ? 1 : .65 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}><strong>{material.name}</strong><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><input type="checkbox" checked={!!material.active} onChange={(e) => setDbMaterials((current) => current.map((item) => item.id === material.id ? { ...item, active: e.target.checked } : item))} /> Actif</label></div>
            <label style={{ display: "block", fontSize: 12 }}>Nom</label><input value={material.name} onChange={(e) => setDbMaterials((current) => current.map((item) => item.id === material.id ? { ...item, name: e.target.value } : item))} style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
            <label style={{ display: "block", fontSize: 12 }}>Catégorie</label><input value={material.category} onChange={(e) => setDbMaterials((current) => current.map((item) => item.id === material.id ? { ...item, category: e.target.value } : item))} style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: 8 }}>
              <div><label style={{ display: "block", fontSize: 12 }}>Capacité (m²/j)</label><input type="number" min="0.1" step="0.1" value={material.indicative_capacity_m2} onChange={(e) => setDbMaterials((current) => current.map((item) => item.id === material.id ? { ...item, indicative_capacity_m2: e.target.value } : item))} placeholder="Réf. globale" style={{ width: "100%", boxSizing: "border-box" }}/></div>
              <div><label style={{ display: "block", fontSize: 12 }}>Difficulté (coef.)</label><input type="number" min="0.1" step="0.1" value={material.planning_difficulty} onChange={(e) => setDbMaterials((current) => current.map((item) => item.id === material.id ? { ...item, planning_difficulty: e.target.value } : item))} style={{ width: "100%", boxSizing: "border-box" }}/></div>
              <div><label style={{ display: "block", fontSize: 12 }}>Ordre</label><input type="number" min="0" step="1" value={material.sort_order} onChange={(e) => setDbMaterials((current) => current.map((item) => item.id === material.id ? { ...item, sort_order: e.target.value } : item))} style={{ width: "100%", boxSizing: "border-box" }}/></div>
            </div>
            <button className="primary" type="button" disabled={materialSaveIds.includes(material.id)} onClick={() => saveMaterialCatalogItem(material)} style={{ marginTop: 12, width: "100%" }}>{materialSaveIds.includes(material.id) ? "Enregistrement…" : "💾 Enregistrer ce matériau"}</button>
          </div>)}
        </div>
      </>}{page === "access" && currentProfile?.role === "admin" && <>
        <h2>Gestion des accès</h2>
        <p style={{ color: "#667085", marginTop: -4 }}>Crée un compte, choisis son profil et, pour une équipe terrain, rattache-le à son équipe. Les comptes désactivés ne peuvent plus accéder aux données SETOM.</p>
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>Inviter un intervenant</h3>
          <form onSubmit={inviteAccessUser} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, alignItems: "end" }}>
            <div><label>Nom affiché</label><input value={inviteDisplayName} onChange={(e) => setInviteDisplayName(e.target.value)} placeholder="Nom et prénom" required style={{ width: "100%", boxSizing: "border-box" }}/></div>
            <div><label>Adresse e-mail</label><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="nom@entreprise.fr" required style={{ width: "100%", boxSizing: "border-box" }}/></div>
            <div><label>Profil d’accès</label><select value={inviteRole} onChange={(e) => { setInviteRole(e.target.value); if (e.target.value !== "equipe_terrain") setInviteTeamId(""); }} style={{ width: "100%", boxSizing: "border-box" }}>{ACCESS_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div>
            {inviteRole === "equipe_terrain" && <div><label>Équipe affectée</label><select value={inviteTeamId} onChange={(e) => setInviteTeamId(e.target.value)} required style={{ width: "100%", boxSizing: "border-box" }}><option value="">Choisir une équipe…</option>{dbTeams.filter((team) => team.active !== false).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>}
            <div><button className="primary" type="submit" disabled={inviteSaving}>{inviteSaving ? "Envoi de l’invitation…" : "✉️ Envoyer l’invitation"}</button></div>
          </form>
          <p style={{ fontSize: 12, color: "#667085", marginBottom: 0 }}>L’intervenant reçoit un e-mail, puis définit son propre mot de passe. Ne partage pas de mot de passe commun.</p>
        </div>
        {accessError && <div className="card" style={{ borderLeft: "4px solid #b42318", color: "#b42318", marginBottom: 12 }}>{accessError}</div>}
        {accessMessage && <div className="card" style={{ borderLeft: "4px solid #027a48", color: "#027a48", marginBottom: 12 }}>{accessMessage}</div>}
        {accessLoading ? <div className="card">Chargement des comptes…</div> : <div style={{ display: "grid", gap: 12 }}>
          {accessProfiles.map((profile) => <div className="card" key={profile.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.3fr) repeat(auto-fit,minmax(180px,1fr))", gap: 12, alignItems: "end", opacity: profile.active ? 1 : 0.7 }}>
            <div><strong>{profile.display_name || "Intervenant"}</strong><div style={{ fontSize: 13, color: "#667085", overflowWrap: "anywhere" }}>{profile.email || "E-mail non renseigné"}</div>{profile.must_set_password && <small style={{ color: "#b54708" }}>Activation en attente</small>}</div>
            <div><label>Profil</label><select value={profile.role || "equipe_terrain"} onChange={(e) => changeAccessProfile(profile.id, "role", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}>{ACCESS_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div>
            {profile.role === "equipe_terrain" && <div><label>Équipe affectée</label><select value={profile.team_id || ""} onChange={(e) => changeAccessProfile(profile.id, "team_id", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}><option value="">Choisir une équipe…</option>{dbTeams.filter((team) => team.active !== false).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>}
            <div><label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={profile.active === true} onChange={(e) => changeAccessProfile(profile.id, "active", e.target.checked)}/>Compte actif</label><button type="button" className="primary" disabled={accessSavingIds.includes(profile.id)} onClick={() => saveAccessProfile(profile)} style={{ marginTop: 8 }}>{accessSavingIds.includes(profile.id) ? "Enregistrement…" : "Enregistrer les accès"}</button></div>
          </div>)}
          {accessProfiles.length === 0 && <div className="card">Aucun compte trouvé.</div>}
        </div>}
      </>}
      {page === "settings" && <><h2>Paramètres du marché</h2>
        {!appSettings ? <div className="card">Chargement des paramètres…</div> : <form onSubmit={saveAppSettings} className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, alignItems: "start" }}>
          <div><label htmlFor="setting-company">Nom de l'application / entreprise</label><input id="setting-company" value={appSettings.company_name || ""} onChange={(e) => setAppSettings((current) => ({ ...current, company_name: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/></div>
          <div><label htmlFor="setting-donor">Donneur d'ordre</label><input id="setting-donor" value={appSettings.donor_name || ""} onChange={(e) => setAppSettings((current) => ({ ...current, donor_name: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/></div>
          <div><label htmlFor="setting-validator">Validateur des travaux</label><input id="setting-validator" value={appSettings.validator_name || ""} onChange={(e) => setAppSettings((current) => ({ ...current, validator_name: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/></div>
          <div><label htmlFor="setting-os-label">Libellé des OS</label><input id="setting-os-label" value={appSettings.os_label || ""} onChange={(e) => setAppSettings((current) => ({ ...current, os_label: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/><small>Ex. « OS » pour OS-2026-00001.</small></div>
          <div><label htmlFor="setting-delay">Délai avant échéance (jours)</label><input id="setting-delay" type="number" min="1" max="365" step="1" value={appSettings.standard_delay_days ?? 25} onChange={(e) => setAppSettings((current) => ({ ...current, standard_delay_days: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/><small>25 jours par défaut. Le réglage s'applique uniquement aux nouveaux OS.</small></div>
          <div><label htmlFor="setting-capacity">Capacité de référence enrobé à chaux (m²/jour)</label><input id="setting-capacity" type="number" min="0.1" step="0.1" value={appSettings.enrobee_reference_capacity_m2 ?? 35} onChange={(e) => setAppSettings((current) => ({ ...current, enrobee_reference_capacity_m2: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/></div>
          <div><label htmlFor="setting-contract-duration">Durée du marché (années)</label><input id="setting-contract-duration" type="number" min="1" max="20" step="1" value={appSettings.contract_duration_years ?? 4} onChange={(e) => setAppSettings((current) => ({ ...current, contract_duration_years: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "center" }}><input type="checkbox" checked={!!appSettings.prices_renegotiable} onChange={(e) => setAppSettings((current) => ({ ...current, prices_renegotiable: e.target.checked }))}/> Prix renégociables lors du renouvellement</label>
          <div style={{ gridColumn: "1 / -1", padding: 12, border: "1px solid #e4e7ec", background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#475467" }}>Ces paramètres pilotent les nouveaux OS et les libellés affichés. Les anciennes échéances ne sont pas recalculées et l'historique reste conservé.</div>
          {settingsError && <div style={{ gridColumn: "1 / -1", color: "#b42318" }}>{settingsError}</div>}
          {settingsMessage && <div style={{ gridColumn: "1 / -1", color: "#027a48" }}>{settingsMessage}</div>}
          <div style={{ gridColumn: "1 / -1" }}><button className="primary" type="submit" disabled={settingsSaving}>{settingsSaving ? "Enregistrement…" : "💾 Enregistrer les paramètres"}</button></div>
        </form>}
      </>}
    </main>
    {selectedOS && <OSModal os={selectedOS} onClose={()=>setSelectedOS(null)} onUpdate={updateOS} profile={currentProfile}/>} 
  </div>;
}

function OSCard({ os, onOpen }) {
  const displayStatus = os.constatStatus === "Validé avec réserve" && !os.reserveResolvedAt ? "Réserve" : os.status;
  const statusColors = getOSStatusColors(displayStatus);
  return <div className="os" style={{ borderLeftColor: statusColors.accent }}><div className="os-top"><div><div className="os-number">{os.id}</div><div className="os-info">📍 {os.address}</div></div><span className="badge os-status-badge" style={getOSStatusBadgeStyle(displayStatus)}>{os.constatStatus === "Validé avec réserve" && !os.reserveResolvedAt ? "Réserve à lever" : os.status}</span></div>{os.constatStatus === "Validé avec réserve" && !os.reserveResolvedAt && os.reserveReason && <div className="os-info" style={{ color: "#9a3412" }}>🚧 Motif de réserve : {os.reserveReason}</div>}<div className="os-info">🔧 {os.work}<br/>🧭 Secteur : {os.sector || "Non classé"}<br/>👷 {os.team}<br/>📅 {os.day||"Non planifié"}<br/>📐 {os.quantity}</div><div className="os-actions"><button className="primary" onClick={onOpen}>Ouvrir l'OS</button><button className="secondary" onClick={()=>window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(os.address)}`,"_blank")}>🧭 Naviguer</button></div></div>;
}

function OSModal({ os, onClose, onUpdate, profile }) {
  const [day, setDay] = useState(os?.day || "");
  const [plannedDate, setPlannedDate] = useState(os?.plannedDate || "");
  const [status, setStatus] = useState(os?.status || "");
  const [activeTab, setActiveTab] = useState("resume");
  const [planningSaving, setPlanningSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [workPhotoFiles, setWorkPhotoFiles] = useState([]);
  const [workPhotoSaving, setWorkPhotoSaving] = useState(false);
  const [realLength, setRealLength] = useState(""); const [realWidth, setRealWidth] = useState(""); const [realSurface, setRealSurface] = useState("");
  const [roadLength, setRoadLength] = useState(""); const [roadWidth, setRoadWidth] = useState(""); const [sidewalkLength, setSidewalkLength] = useState(""); const [sidewalkWidth, setSidewalkWidth] = useState("");
  const [otherLength, setOtherLength] = useState(""); const [otherWidth, setOtherWidth] = useState(""); const [realRoadSurface, setRealRoadSurface] = useState(""); const [realSidewalkSurface, setRealSidewalkSurface] = useState(""); const [realOtherSurface, setRealOtherSurface] = useState("");
  const [thickness, setThickness] = useState(""); const [sciage, setSciage] = useState(""); const [joints, setJoints] = useState(""); const [boucheAcle, setBoucheAcle] = useState("");
  const [circulationType, setCirculationType] = useState(""); const [circulationHours, setCirculationHours] = useState(""); const [marquageSurface, setMarquageSurface] = useState(""); const [workComment, setWorkComment] = useState("");
  const [constat, setConstat] = useState(null); const [constatLines, setConstatLines] = useState([]); const [constatLoading, setConstatLoading] = useState(false); const [constatEditMode, setConstatEditMode] = useState(false); const [editableConstatLines, setEditableConstatLines] = useState([]); const [constatEditObservations, setConstatEditObservations] = useState(""); const [constatSaving, setConstatSaving] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [issueReason, setIssueReason] = useState(os?.suspensionReason || "");
  const [issueComment, setIssueComment] = useState(os?.suspensionComment || "");
  const [issueNightProposal, setIssueNightProposal] = useState(!!os?.isNight);
  const [issueSaving, setIssueSaving] = useState(false);
  const [osEditMode, setOsEditMode] = useState(false);
  const [osEditLoading, setOsEditLoading] = useState(false);
  const [osEditSaving, setOsEditSaving] = useState(false);
  const [osEditError, setOsEditError] = useState("");
  const [osEditDraft, setOsEditDraft] = useState({ address: "", postal_code: "", city: "", material_detail: "", planned_surface_m2: "", deadline_date: "", particularities: "" });

  useEffect(() => {
    setIssueReason(os?.suspensionReason || "");
    setIssueComment(os?.suspensionComment || "");
    setIssueNightProposal(!!os?.isNight);
  }, [os?.dbId, os?.suspensionReason, os?.suspensionComment, os?.isNight]);

  useEffect(() => {
    if (!os?.dbId) return;
    let cancelled = false;
    async function loadEditableOSFields() {
      setOsEditLoading(true); setOsEditError("");
      const { data, error } = await supabase.from("work_orders").select("address, postal_code, city, sector_id, material_detail, planned_surface_m2, deadline_date, particularities").eq("id", os.dbId).single();
      if (error) {
        console.error("Erreur chargement des informations modifiables de l'OS :", error);
        if (!cancelled) { setOsEditError(error.message || "Impossible de charger l'OS."); setOsEditLoading(false); }
        return;
      }
      if (!cancelled) {
        setOsEditDraft({ address: data.address || "", postal_code: data.postal_code || "", city: data.city || "", sector_id: data.sector_id || "", material_detail: data.material_detail || "", planned_surface_m2: data.planned_surface_m2 == null ? "" : String(data.planned_surface_m2), deadline_date: data.deadline_date || "", particularities: data.particularities || "" });
        setOsEditLoading(false);
      }
    }
    loadEditableOSFields();
    return () => { cancelled = true; };
  }, [os?.dbId]);

  useEffect(() => {
    if (!os?.dbId) return;
    if (!["admin","bureau","eau_de_toulouse"].includes(profile?.role)) { setConstat(null); setConstatLines([]); setConstatLoading(false); return undefined; }
    let cancelled = false;
    async function loadConstat() {
      setConstatLoading(true);
      const { data: payload, error: readError } = await supabase.rpc("get_constat_for_work_order", { p_work_order_id: os.dbId });
      if (readError) { console.error("Erreur lecture constat :", readError); if(!cancelled){setConstat(null);setConstatLines([]);setConstatLoading(false);} return; }
      let constatData = payload?.constat || null, linesData = payload?.lines || [];
      if (!constatData && os.status === "Travaux effectués" && ["admin","bureau"].includes(profile?.role)) {
        const { data: authData } = await supabase.auth.getUser(); const userId = authData?.user?.id || null;
        const { error: rpcError } = await supabase.rpc("regenerate_constat_for_work_order", { p_work_order_id: os.dbId, p_user_id: userId });
        if (!rpcError) { const { data: refreshed, error: refreshError } = await supabase.rpc("get_constat_for_work_order", { p_work_order_id: os.dbId }); if(!refreshError){constatData=refreshed?.constat||null;linesData=refreshed?.lines||[];} } else console.error("Erreur génération constat automatique :", rpcError);
      }
      if(!cancelled){setConstat(constatData);setConstatLines(linesData);setConstatLoading(false);}
    }
    loadConstat(); return ()=>{cancelled=true;};
  }, [os?.dbId, os?.status, profile?.role]);

  useEffect(() => {
    if (!os?.dbId) return;
    async function loadAttachments() {
      setAttachmentsLoading(true);
      const { data, error } = await supabase.from("attachments").select("*").eq("work_order_id", os.dbId).order("created_at", { ascending:false });
      if(error){console.error("Erreur chargement fichiers :",error);setAttachments([]);setAttachmentsLoading(false);return;}
      const filesWithUrls = await Promise.all((data||[]).map(async(file)=>{const {data:signedData,error:signedError}=await supabase.storage.from("setom-files").createSignedUrl(file.storage_path,3600);return {...file,url:signedError?null:(signedData?.signedUrl||null)};}));
      setAttachments(filesWithUrls); setAttachmentsLoading(false);
    }
    loadAttachments();
  }, [os?.dbId]);

  async function saveIssueReport() {
    if (!os?.dbId || issueSaving) return;
    if (!["À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status)) {
      alert("Le signalement est réservé aux OS avant transmission des travaux réalisés.");
      return;
    }
    if (!issueReason.trim()) {
      alert("Sélectionnez le motif du problème avant d'enregistrer le signalement.");
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) { alert("Connexion requise pour signaler un problème."); return; }
    const now = new Date().toISOString();
    const alreadyInError = os.status === "En erreur";
    setIssueSaving(true);
    try {
      const updates = {
        problem_suspended: true,
        suspension_reason: issueReason.trim(),
        suspension_comment: issueComment.trim() || null,
        is_night: !!issueNightProposal,
        updated_by: user.id,
        ...(alreadyInError ? {} : { status: "En erreur", suspension_started_at: now, suspension_restarted_at: null })
      };
      const { error: updateError } = await supabase.from("work_orders").update(updates).eq("id", os.dbId);
      if (updateError) throw updateError;
      const changes = {
        status: "En erreur",
        problemSuspended: true,
        suspensionReason: issueReason.trim(),
        suspensionComment: issueComment.trim(),
        suspensionStartedAt: alreadyInError ? (os.suspensionStartedAt || now) : now,
        suspensionRestartedAt: null,
        isNight: !!issueNightProposal
      };
      setStatus("En erreur");
      onUpdate(os.id, changes);
      window.dispatchEvent(new Event("setom:planning-updated"));
      alert(alreadyInError ? "✅ Signalement mis à jour." : "✅ OS signalé en erreur. Sa date et son équipe sont conservées pour la reprise.");
    } catch (error) {
      console.error("Erreur d'enregistrement du signalement :", error);
      alert("Impossible d'enregistrer le signalement :\n\n" + (error?.message || "Erreur inconnue"));
    } finally { setIssueSaving(false); }
  }

  async function reactivateIssueOrder() {
    if (!os?.dbId || os.status !== "En erreur" || issueSaving) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) { alert("Connexion requise pour réactiver l'OS."); return; }
    const nextStatus = plannedDate ? "Planifié" : "À planifier";
    if (!window.confirm("Réactiver cet OS et le remettre " + (plannedDate ? "à sa date planifiée" : "dans la file À planifier") + " ?")) return;
    setIssueSaving(true);
    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase.from("work_orders").update({
        status: nextStatus,
        problem_suspended: false,
        suspension_restarted_at: now,
        updated_by: user.id
      }).eq("id", os.dbId);
      if (updateError) throw updateError;
      setStatus(nextStatus);
      onUpdate(os.id, { status: nextStatus, problemSuspended: false, suspensionRestartedAt: now });
      window.dispatchEvent(new Event("setom:planning-updated"));
      alert("✅ OS réactivé. Le motif reste conservé dans son historique.");
    } catch (error) {
      console.error("Erreur de réactivation OS :", error);
      alert("Impossible de réactiver l'OS :\n\n" + (error?.message || "Erreur inconnue"));
    } finally { setIssueSaving(false); }
  }

  async function saveOSEdit(event) {
    event.preventDefault();
    setOsEditError("");
    if (!os?.dbId || osEditSaving) return;
    if (!["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status)) {
      setOsEditError("Les informations de l'OS sont verrouillées après la transmission des travaux. Utilisez le constat pour les ajustements de facturation.");
      return;
    }
    const address = String(osEditDraft.address || "").trim();
    const material = String(osEditDraft.material_detail || "").trim();
    const surfaceText = String(osEditDraft.planned_surface_m2 ?? "").trim().replace(",", ".");
    const surface = surfaceText === "" ? null : Number(surfaceText);
    if (!address) { setOsEditError("L'adresse est obligatoire."); return; }
    if (!material) { setOsEditError("Le matériau ou type d'intervention est obligatoire."); return; }
    if (surface !== null && (!Number.isFinite(surface) || surface < 0)) { setOsEditError("La surface prévue doit être un nombre positif ou nul."); return; }
    if (!osEditDraft.deadline_date) { setOsEditError("L'échéance de l'OS est obligatoire."); return; }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) { setOsEditError("Connexion requise pour modifier cet OS."); return; }
    setOsEditSaving(true);
    try {
      const payload = {
        address,
        postal_code: String(osEditDraft.postal_code || "").trim() || null,
        city: String(osEditDraft.city || "").trim() || null,
        material_detail: material,
        sector_id: osEditDraft.sector_id || null,
        planned_surface_m2: surface,
        deadline_date: osEditDraft.deadline_date,
        particularities: String(osEditDraft.particularities || "").trim() || null,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from("work_orders").update(payload).eq("id", os.dbId).select("address, postal_code, city, sector_id, material_detail, planned_surface_m2, deadline_date, particularities").single();
      if (error) throw error;
      const saved = {
        address: data.address || "",
        postal_code: data.postal_code || "",
        city: data.city || "",
        sector_id: data.sector_id || "",
        material_detail: data.material_detail || "",
        planned_surface_m2: data.planned_surface_m2 == null ? "" : String(data.planned_surface_m2),
        deadline_date: data.deadline_date || "",
        particularities: data.particularities || ""
      };
      setOsEditDraft(saved);
      setOsEditMode(false);
      onUpdate(os.id, {
        address: saved.address + (saved.city ? ", " + saved.city : ""),
        work: saved.material_detail || "Intervention",
        intervention: saved.material_detail || "Intervention",
        trade: saved.material_detail || "Intervention",
        sector: dbSectors.find((sector) => sector.id === saved.sector_id)?.name || "Non classé",
        sectorId: saved.sector_id || "",
        quantity: saved.planned_surface_m2 === "" ? "" : saved.planned_surface_m2 + " m²",
        deadline: saved.deadline_date,
        postalCode: saved.postal_code,
        city: saved.city,
        materialDetail: saved.material_detail,
        particularities: saved.particularities
      });
      window.dispatchEvent(new Event("setom:planning-updated"));
      alert("✅ Informations de l'OS enregistrées.");
    } catch (error) {
      console.error("Erreur modification OS :", error);
      setOsEditError(error?.message || "Impossible d'enregistrer les modifications.");
    } finally { setOsEditSaving(false); }
  }

  async function savePlanning() {
    if(!os?.dbId)return; setPlanningSaving(true);
    try {
      const {data:authData}=await supabase.auth.getUser(); const userId=authData?.user?.id||null;
      let {data:intervention,error:interventionError}=await supabase.from("interventions").select("id").eq("work_order_id",os.dbId).maybeSingle(); if(interventionError)throw interventionError;
      if(!intervention){const {data:created,error}=await supabase.from("interventions").insert({work_order_id:os.dbId,type:os.intervention||os.work||"Intervention",status:plannedDate?"Planifié":"À planifier",planned_date:plannedDate||null,planned_surface_m2:Number(String(os.quantity||"").replace(" m²","").replace(",","."))||null}).select("id").single();if(error)throw error;intervention=created;}
      else {const {error}=await supabase.from("interventions").update({planned_date:plannedDate||null,status:plannedDate?"Planifié":"À planifier",updated_at:new Date().toISOString()}).eq("id",intervention.id);if(error)throw error;}
      const nextStatus=plannedDate?"Planifié":"À planifier";const {error:woError}=await supabase.from("work_orders").update({status:nextStatus,updated_by:userId}).eq("id",os.dbId);if(woError)throw woError;
      const nextDay=plannedDate?(()=>{const label=new Date(`${plannedDate}T12:00:00`).toLocaleDateString("fr-FR",{weekday:"long"});return label.charAt(0).toUpperCase()+label.slice(1);})():null;
      onUpdate(os.id,{day:nextDay,plannedDate:plannedDate||null,status:nextStatus,interventionId:intervention.id});setStatus(nextStatus);setDay(nextDay||"");alert(plannedDate?"✅ Planning enregistré.":"✅ OS retiré du planning.");
    }catch(error){console.error("Erreur planning :",error);alert("Impossible d'enregistrer le planning :\n\n"+(error?.message||"Erreur inconnue"));}finally{setPlanningSaving(false);}
  }

  async function uploadWorkPhotos(interventionId=os?.interventionId||null,showSuccess=true){
    if(!os?.dbId||workPhotoFiles.length===0)return true; setWorkPhotoSaving(true); const uploadedAttachments=[];
    try { const {data:authData,error:authError}=await supabase.auth.getUser(); const user=authData?.user;if(authError||!user)throw new Error("Utilisateur non connecté.");
      for(const file of workPhotoFiles){if(!file.type?.startsWith("image/"))throw new Error("Seules les images peuvent être ajoutées comme photos des travaux réalisés.");const safeFileName=file.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");const storagePath="work-orders/"+os.dbId+"/travaux-realises/"+Date.now()+"-"+safeFileName;const {error:uploadError}=await supabase.storage.from("setom-files").upload(storagePath,file,{cacheControl:"3600",upsert:false});if(uploadError)throw uploadError;const {data:attachment,error:attachmentError}=await supabase.from("attachments").insert({work_order_id:os.dbId,intervention_id:interventionId||null,category:"travaux_realises",file_name:file.name,storage_path:storagePath,mime_type:file.type||null,captured_at:new Date().toISOString(),created_by:user.id}).select("*").single();if(attachmentError){await supabase.storage.from("setom-files").remove([storagePath]);throw attachmentError;}const {data:signedData,error:signedError}=await supabase.storage.from("setom-files").createSignedUrl(storagePath,3600);uploadedAttachments.push({...attachment,url:signedError?null:(signedData?.signedUrl||null)});}
      setAttachments((current)=>[...uploadedAttachments,...current]);setWorkPhotoFiles([]);if(showSuccess)alert("✅ Photos des travaux enregistrées.");return true;
    }catch(error){console.error("Erreur enregistrement photos des travaux :",error);alert("Impossible d'enregistrer les photos des travaux :\n\n"+(error?.message||"Erreur inconnue"));return false;}finally{setWorkPhotoSaving(false);}
  }

  async function save() {
    if(["À planifier","Nouveau"].includes(os?.status)){alert("Cet OS n'est pas encore planifié. Enregistrez d'abord une date dans l'onglet Planning.");setActiveTab("planning");return;}
    if(["Constat à vérifier","Constat validé","Travaux effectués","Payé","Archivé"].includes(os?.status)){setActiveTab(["admin","bureau"].includes(profile?.role)?"constat":"resume");alert("Les travaux ont déjà été transmis pour cet OS. Vérifiez le constat depuis le profil bureau.");return;}
    if(!["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status)){alert("Le statut actuel de cet OS ne permet pas de transmettre les travaux : "+(os?.status||"non renseigné")+".");return;}
    try {
      const {data:authData,error:userError}=await supabase.auth.getUser();const user=authData?.user;if(userError||!user)throw new Error("Utilisateur non connecté.");
      let {data:intervention,error:interventionError}=await supabase.from("interventions").select("id, work_order_id, type, status, planned_surface_m2, actual_surface_m2").eq("work_order_id",os.dbId).maybeSingle();if(interventionError)throw new Error("Impossible de retrouver l'intervention : "+interventionError.message);
      if(!intervention){const {data:newIntervention,error:createInterventionError}=await supabase.from("interventions").insert({work_order_id:os.dbId,type:os.intervention||os.work||"Intervention",status:"Travaux en cours",planned_surface_m2:os.quantity&&parseFloat(os.quantity)?parseFloat(os.quantity):null,planned_date:os.plannedDate||null,actual_surface_m2:null}).select("*").single();if(createInterventionError)throw new Error("Impossible de créer l'intervention : "+createInterventionError.message);intervention=newIntervention;}
      const roadActual=realRoadSurface!==""&&!isNaN(Number(realRoadSurface))?Number(realRoadSurface):0,sidewalkActual=realSidewalkSurface!==""&&!isNaN(Number(realSidewalkSurface))?Number(realSidewalkSurface):0,otherActual=realOtherSurface!==""&&!isNaN(Number(realOtherSurface))?Number(realOtherSurface):0,genericActual=realSurface!==""&&!isNaN(Number(realSurface))?Number(realSurface):0;
      const totalActualSurface=os.rehabilitationZone==="Chaussée + trottoir"?roadActual+sidewalkActual:os.rehabilitationZone==="Chaussée"?roadActual:os.rehabilitationZone==="Trottoir"?sidewalkActual:os.rehabilitationZone==="Autre"?otherActual:genericActual;
      const plannedSurface=Number(os.quantity?.replace(" m²","").replace(",","."))||0,automaticDemolition=Math.max(0,totalActualSurface-plannedSurface),realizations=[];
      if(totalActualSurface>0)realizations.push({intervention_id:intervention.id,designation:os.intervention||os.work||"Travaux réalisés",quantity:totalActualSurface,unit:"m²",surface_m2:totalActualSurface,thickness_cm:thickness!==""&&!isNaN(Number(thickness))?Number(thickness):null,observations:workComment||null});
      if(sciage!==""&&!isNaN(Number(sciage)))realizations.push({intervention_id:intervention.id,designation:"Sciage",quantity:Number(sciage),unit:"ml",length_ml:Number(sciage)});
      if(joints!==""&&!isNaN(Number(joints)))realizations.push({intervention_id:intervention.id,designation:"Joints",quantity:Number(joints),unit:"ml",length_ml:Number(joints)});
      if(boucheAcle!==""&&!isNaN(Number(boucheAcle)))realizations.push({intervention_id:intervention.id,designation:"Bouché à clé",quantity:Number(boucheAcle),unit:"U"});
      if(automaticDemolition>0)realizations.push({intervention_id:intervention.id,designation:"Démolition",quantity:automaticDemolition,unit:"m²",surface_m2:automaticDemolition});
      if(circulationType&&circulationHours!==""&&!isNaN(Number(circulationHours))&&Number(circulationHours)>0){const designation=circulationType==="K10"?"Circulation alternée manuelle par 2 agents munis de panneaux K10":"Circulation alternée par 2 feux tricolores à batterie synchronisés, y compris la présignalisation, l'entretien et la surveillance des feux";realizations.push({intervention_id:intervention.id,designation,quantity:Number(circulationHours)/4,unit:"1/2 j",observations:Number(circulationHours)+" h"});}
      if(marquageSurface!==""&&!isNaN(Number(marquageSurface))&&Number(marquageSurface)>0)realizations.push({intervention_id:intervention.id,designation:"Marquage",quantity:Number(marquageSurface),unit:"m²",surface_m2:Number(marquageSurface)});
      const {error:deleteRealizationsError}=await supabase.from("work_realizations").delete().eq("intervention_id",intervention.id);if(deleteRealizationsError)throw new Error("Erreur lors du remplacement des travaux réalisés : "+deleteRealizationsError.message);
      if(realizations.length>0){const {error:realizationError}=await supabase.from("work_realizations").insert(realizations);if(realizationError)throw new Error("Erreur lors de l'enregistrement des travaux réalisés : "+realizationError.message);}
      if(workPhotoFiles.length===0&&!attachments.some((file)=>file.category==="travaux_realises"&&file.mime_type?.startsWith("image/"))){alert("Transmission impossible : ajoutez au moins une photo des travaux réalisés.");return;}
      const photosSaved=await uploadWorkPhotos(intervention.id,false);if(!photosSaved)return;
      const {error:workOrderError}=await supabase.from("work_orders").update({actual_road_surface_m2:os.rehabilitationZone==="Chaussée"||os.rehabilitationZone==="Chaussée + trottoir"?(roadActual||null):null,actual_sidewalk_surface_m2:os.rehabilitationZone==="Trottoir"||os.rehabilitationZone==="Chaussée + trottoir"?(sidewalkActual||null):null,actual_other_surface_m2:os.rehabilitationZone==="Autre"?(otherActual||null):null,updated_by:user.id}).eq("id",os.dbId);if(workOrderError)throw new Error("Impossible d'enregistrer les surfaces de l'OS : "+workOrderError.message);
      const {error:prepareInterventionError}=await supabase.from("interventions").update({status:"Travaux en cours",actual_surface_m2:totalActualSurface>0?totalActualSurface:null}).eq("id",intervention.id);if(prepareInterventionError)throw new Error("Impossible de préparer la transmission des travaux : "+prepareInterventionError.message);
      const {error:updateInterventionError}=await supabase.from("interventions").update({status:"Travaux effectués",actual_date:new Date().toISOString().slice(0,10),actual_surface_m2:totalActualSurface>0?totalActualSurface:null}).eq("id",intervention.id);if(updateInterventionError)throw new Error("Impossible de transmettre les travaux : "+updateInterventionError.message);
      // Synchroniser explicitement le statut de l'OS avec l'intervention.
      // Cela évite qu'une transmission réussie reste affichée comme "Planifié"
      // ou "Travaux en cours" lorsque le trigger de synchronisation n'est pas disponible.
      const {data:currentOrder,error:currentOrderError}=await supabase.from("work_orders").select("status").eq("id",os.dbId).single();
      if(currentOrderError)throw new Error("Impossible de vérifier le statut de l'OS : "+currentOrderError.message);
      if(currentOrder?.status === "Planifié"){
        const {error:moveToInProgressError}=await supabase.from("work_orders").update({status:"Travaux en cours",updated_by:user.id}).eq("id",os.dbId);
        if(moveToInProgressError)throw new Error("Impossible de passer l'OS en travaux : "+moveToInProgressError.message);
      }
      const {error:moveToRealizedError}=await supabase.from("work_orders").update({status:"Travaux réalisés",updated_by:user.id}).eq("id",os.dbId);
      if(moveToRealizedError)throw new Error("Impossible de mettre l'OS en travaux réalisés : "+moveToRealizedError.message);
      const {error:moveToConstatError}=await supabase.from("work_orders").update({status:"Constat à vérifier",updated_by:user.id}).eq("id",os.dbId);
      if(moveToConstatError)throw new Error("Impossible de préparer le constat : "+moveToConstatError.message);
      const {data:refreshedOS,error:refreshError}=await supabase.from("work_orders").select("status,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2").eq("id",os.dbId).single();if(refreshError)throw new Error("Les travaux ont été transmis, mais l'OS n'a pas pu être relu : "+refreshError.message);
      if (["admin","bureau"].includes(profile?.role)) {
        const {data:constatPayload,error:constatReadError}=await supabase.rpc("get_constat_for_work_order",{p_work_order_id:os.dbId});
        if(!constatReadError){setConstat(constatPayload?.constat||null);setConstatLines(constatPayload?.lines||[]);} else console.error("Constat transmis mais lecture impossible :",constatReadError);
      }
      const finalStatus=refreshedOS?.status||"Constat à vérifier";
      onUpdate(os.id,{day:os.day||null,plannedDate:os.plannedDate||null,status:finalStatus,actualRoadSurface:refreshedOS?.actual_road_surface_m2??(roadActual||null),actualSidewalkSurface:refreshedOS?.actual_sidewalk_surface_m2??(sidewalkActual||null),actualOtherSurface:refreshedOS?.actual_other_surface_m2??(otherActual||null),interventionId:intervention.id});
      setActiveTab(["admin","bureau"].includes(profile?.role) ? "constat" : "travaux");
      alert(finalStatus==="Constat à vérifier"?"✅ Travaux transmis. Le constat automatique est prêt à être vérifié.":"✅ Travaux enregistrés. Statut actuel de l'OS : "+finalStatus+".");
    }catch(error){console.error("Erreur générale lors de la transmission des travaux :",error);alert("Erreur lors de l'enregistrement :\n\n"+(error?.message||"Erreur inconnue")+(error?.details?"\n\nDétails : "+error.details:"")+(error?.hint?"\n\nAide : "+error.hint:""));}
  }

  const constatLocked=["Validé","Validé avec réserve","Payé","Archivé"].includes(constat?.status);
  const travauxPhotos=attachments.filter((file)=>file.category==="travaux_realises"&&file.mime_type?.startsWith("image/")&&file.url);

  function startConstatEdit(){if(!constat||constatLocked)return;setEditableConstatLines((constatLines||[]).map((line)=>({id:line.id,bpu_line_id:line.bpu_line_id||"",designation:line.designation||"",quantity:line.quantity??0,unit:line.unit||"",unit_price:line.unit_price??0,amount:line.amount??0,thickness_cm:line.thickness_cm??"",observations:line.observations||"",actual_quantity:line.actual_quantity??"",billing_coefficient:line.billing_coefficient??"",reference_thickness_cm:line.reference_thickness_cm??"",actual_thickness_cm:line.actual_thickness_cm??""})));setConstatEditObservations(constat.observations||"");setConstatEditMode(true);}
  function updateEditableConstatLine(index,field,value){setEditableConstatLines((current)=>current.map((line,i)=>{if(i!==index)return line;const next={...line,[field]:value};if(field==="quantity"||field==="unit_price"){next.amount=((Number(next.quantity)||0)*(Number(next.unit_price)||0)).toFixed(2);}return next;}));}
  function addEditableConstatLine(){setEditableConstatLines((current)=>[...current,{id:`new-${Date.now()}-${current.length}`,bpu_line_id:"",designation:"",quantity:0,unit:"",unit_price:0,amount:0,thickness_cm:"",observations:"",actual_quantity:"",billing_coefficient:"",reference_thickness_cm:"",actual_thickness_cm:""}]);}
  function removeEditableConstatLine(index){setEditableConstatLines((current)=>current.filter((_,i)=>i!==index));}
  async function saveConstatManual(){if(!constat||constatLocked)return;setConstatSaving(true);try{const cleanLines=editableConstatLines.map((line)=>({bpu_line_id:line.bpu_line_id||"",designation:String(line.designation||"").trim()||"Prestation",quantity:Number(line.quantity)||0,unit:String(line.unit||"").trim(),unit_price:Number(line.unit_price)||0,thickness_cm:line.thickness_cm===""?"":Number(line.thickness_cm),observations:line.observations||"",actual_quantity:line.actual_quantity===""?"":Number(line.actual_quantity),billing_coefficient:line.billing_coefficient===""?"":Number(line.billing_coefficient),reference_thickness_cm:line.reference_thickness_cm===""?"":Number(line.reference_thickness_cm),actual_thickness_cm:line.actual_thickness_cm===""?"":Number(line.actual_thickness_cm)}));const {data,error}=await supabase.rpc("update_constat_manual",{p_work_order_id:os.dbId,p_constat_id:constat.id,p_observations:constatEditObservations||null,p_lines:cleanLines});if(error)throw error;setConstat(data?.constat||null);setConstatLines(data?.lines||[]);setConstatEditMode(false);alert("✅ Constat modifié manuellement.");}catch(error){console.error("Erreur modification constat :",error);alert("Impossible d'enregistrer le constat :\n\n"+(error?.message||"Erreur inconnue"));}finally{setConstatSaving(false);}}

      async function markConstatWithReserve() {
      if (!constat || !os?.dbId || constatSaving) return;
      if (constat.status !== "Validé" || os.status !== "Travaux effectués") {
        alert("Le retour en réserve est disponible après validation du constat.");
        return;
      }
      const reason = window.prompt("Motif du retour en réserve (obligatoire) :");
      if (!reason || !reason.trim()) return;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authError || !user) { alert("Connexion requise pour enregistrer la réserve."); return; }
      setConstatSaving(true);
      try {
        const { data: result, error } = await supabase.rpc("mark_constat_with_reserve", {
          p_work_order_id: os.dbId,
          p_constat_id: constat.id,
          p_user_id: user.id,
          p_reason: reason.trim()
        });
        if (error) throw error;
        if (result?.constat_status !== "Validé avec réserve") throw new Error("La base n'a pas confirmé l'enregistrement de la réserve.");
        const reservedAt = new Date().toISOString();
        setConstat({ ...constat, status: "Validé avec réserve", reserved_at: reservedAt, reserve_reason: reason.trim(), reserve_resolved_at: null, reserve_resolved_by: null });
        onUpdate(os.id, { constatStatus: "Validé avec réserve", reservedAt, reserveReason: reason.trim(), reserveResolvedAt: null });
        window.dispatchEvent(new Event("setom:planning-updated"));
        alert("✅ Réserve enregistrée. Le paiement restera bloqué jusqu'à la levée de la réserve.");
      } catch (error) {
        console.error("Erreur enregistrement réserve :", error);
        alert("Impossible d'enregistrer la réserve :\n\n" + (error?.message || "Erreur inconnue"));
      } finally { setConstatSaving(false); }
    }

    async function resolveConstatReserve() {
      if (!constat || !os?.dbId || constatSaving) return;
      if (constat.status !== "Validé avec réserve" || constat.reserve_resolved_at) return;
      if (!window.confirm("Confirmer que les corrections demandées ont été réalisées et que la réserve est levée ?")) return;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authError || !user) { alert("Connexion requise pour lever la réserve."); return; }
      setConstatSaving(true);
      try {
        const { data: result, error } = await supabase.rpc("resolve_constat_reserve", {
          p_work_order_id: os.dbId,
          p_constat_id: constat.id,
          p_user_id: user.id
        });
        if (error) throw error;
        if (result?.constat_status !== "Validé avec réserve" || !result?.reserve_resolved_at) throw new Error("La base n'a pas confirmé la levée de la réserve.");
        setConstat({ ...constat, reserve_resolved_at: result.reserve_resolved_at, reserve_resolved_by: user.id });
        onUpdate(os.id, { reserveResolvedAt: result.reserve_resolved_at });
        window.dispatchEvent(new Event("setom:planning-updated"));
        alert("✅ Réserve levée. Le paiement peut maintenant être enregistré après confirmation du règlement.");
      } catch (error) {
        console.error("Erreur levée réserve :", error);
        alert("Impossible de lever la réserve :\n\n" + (error?.message || "Erreur inconnue"));
      } finally { setConstatSaving(false); }
    }

async function markConstatPaid() {
    if (!constat || !os?.dbId || constatSaving) return;
    if (!(constat.status === "Validé" || (constat.status === "Validé avec réserve" && !!constat.reserve_resolved_at)) || os.status !== "Travaux effectués") {
      alert("Le paiement est disponible uniquement après validation du constat et passage de l'OS en Travaux effectués.");
      return;
    }
    if (!window.confirm("Confirmer que ce constat a été payé ? Cette action fera passer l'OS au statut « Payé ».") ) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) { alert("Connexion requise pour enregistrer le paiement."); return; }
    setConstatSaving(true);
    try {
      const { data: result, error } = await supabase.rpc("mark_constat_paid_for_work_order", {
        p_work_order_id: os.dbId,
        p_constat_id: constat.id,
        p_user_id: user.id
      });
      if (error) throw error;
      if (result?.constat_status !== "Payé" || result?.work_order_status !== "Payé") {
        throw new Error("La base n'a pas confirmé le passage du constat et de l'OS au statut Payé.");
      }
      setConstat({ ...constat, status: "Payé" });
      setStatus("Payé");
      onUpdate(os.id, { status: "Payé" });
      window.dispatchEvent(new Event("setom:planning-updated"));
      alert("✅ Paiement enregistré. L'OS peut maintenant être archivé.");
    } catch (error) {
      console.error("Erreur d'enregistrement du paiement :", error);
      alert("Impossible d'enregistrer le paiement :\n\n" + (error?.message || "Erreur inconnue"));
    } finally { setConstatSaving(false); }
  }

  async function archiveOSAfterPayment() {
    if (!constat || !os?.dbId || constatSaving) return;
    if (constat.status !== "Payé" || os.status !== "Payé") {
      alert("L'archivage est autorisé uniquement lorsque le constat et l'OS sont payés.");
      return;
    }
    if (!window.confirm("Archiver cet OS payé ? Il restera consultable, mais sera retiré des opérations actives.")) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) { alert("Connexion requise pour archiver l'OS."); return; }
    setConstatSaving(true);
    try {
      const { data: result, error } = await supabase.rpc("archive_paid_work_order", {
        p_work_order_id: os.dbId,
        p_constat_id: constat.id,
        p_user_id: user.id
      });
      if (error) throw error;
      if (result?.constat_status !== "Archivé" || result?.work_order_status !== "Archivé") {
        throw new Error("La base n'a pas confirmé l'archivage du constat et de l'OS.");
      }
      setConstat({ ...constat, status: "Archivé" });
      setStatus("Archivé");
      onUpdate(os.id, { status: "Archivé" });
      window.dispatchEvent(new Event("setom:planning-updated"));
      alert("✅ OS archivé. Il reste conservé dans l'historique.");
    } catch (error) {
      console.error("Erreur d'archivage OS :", error);
      alert("Impossible d'archiver l'OS :\n\n" + (error?.message || "Erreur inconnue"));
    } finally { setConstatSaving(false); }
  }

  async function validateConstat(){
    if(!constat||constatLocked||constatEditMode||constatSaving)return;
    if(!["Brouillon","À vérifier","À valider"].includes(constat.status||"Brouillon")){
      alert("Le statut actuel du constat ne permet pas cette validation : "+(constat.status||"inconnu")+".");
      return;
    }
    if(!os?.dbId){alert("Impossible d'identifier l'OS associé au constat.");return;}
    const {data:authData,error:authError}=await supabase.auth.getUser();
    const user=authData?.user;
    if(authError||!user){alert("Connexion requise pour valider le constat.");return;}
    if(!window.confirm("Valider ce constat de facturation ? L'OS passera automatiquement à « Travaux effectués »."))return;
    setConstatSaving(true);
    try {
      const {data:result,error:validationError}=await supabase.rpc("validate_constat_for_work_order",{
        p_work_order_id:os.dbId,
        p_constat_id:constat.id,
        p_user_id:user.id
      });
      if(validationError)throw validationError;
      if(result?.constat_status!=="Validé")throw new Error("La base de données n'a pas confirmé la validation du constat.");

      const {data:refreshedPayload,error:constatReadError}=await supabase.rpc("get_constat_for_work_order",{p_work_order_id:os.dbId});
      if(!constatReadError&&refreshedPayload?.constat){
        setConstat(refreshedPayload.constat);
        setConstatLines(refreshedPayload.lines||[]);
      }else{
        if(constatReadError)console.error("Constat validé mais relecture impossible :",constatReadError);
        setConstat({...constat,status:"Validé",validated_at:new Date().toISOString(),validated_by:user.id});
      }

      let finalStatus=result?.work_order_status||null;
      if(!finalStatus){
        const {data:refreshedOS,error:refreshError}=await supabase.from("work_orders").select("status").eq("id",os.dbId).single();
        if(refreshError)console.error("Constat validé mais statut OS impossible à relire :",refreshError);
        finalStatus=refreshedOS?.status||"Constat validé";
      }
      onUpdate(os.id,{status:finalStatus});
      alert(finalStatus==="Travaux effectués"?"✅ Constat validé. L'OS est automatiquement passé à « Travaux effectués ».":"Constat validé. Le statut actuel de l'OS est : "+finalStatus+".");
    }catch(error){
      console.error("Erreur validation du constat :",error);
      alert("Impossible de valider le constat :\\n\\n"+(error?.message||"Erreur inconnue")+(error?.details?"\\n\\nDétails : "+error.details:"")+(error?.hint?"\\n\\nAide : "+error.hint:""));
    }finally{setConstatSaving(false);}
  }

  async function regenerateConstatFromWorks(){if(!constat||constatLocked)return;if(!window.confirm("Recalculer le constat à partir des travaux réalisés ?\n\nLes modifications manuelles actuellement présentes dans le constat seront remplacées."))return;const {data:authData}=await supabase.auth.getUser();const userId=authData?.user?.id||null;const {error}=await supabase.rpc("regenerate_constat_for_work_order",{p_work_order_id:os.dbId,p_user_id:userId});if(error){alert("Impossible de recalculer le constat :\n\n"+error.message);return;}const {data:refreshed,error:refreshError}=await supabase.rpc("get_constat_for_work_order",{p_work_order_id:os.dbId});if(refreshError){alert("Le recalcul est terminé mais le constat n'a pas pu être relu.");return;}setConstat(refreshed?.constat||null);setConstatLines(refreshed?.lines||[]);setConstatEditMode(false);alert("✅ Constat recalculé depuis les travaux.");}

  const canManagePlanning = ["admin","bureau"].includes(profile?.role);
  const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status);
  const canManageBilling = ["admin","bureau"].includes(profile?.role);
  const canViewBilling = ["admin","bureau","eau_de_toulouse"].includes(profile?.role);
  const isExternalReadOnly = profile?.role === "eau_de_toulouse";
  const tabs=[{id:"resume",label:"Résumé",icon:"📋"},{id:"travaux",label:"Travaux",icon:"🛠️"},{id:"planning",label:"Planning",icon:"📅"},{id:"photos",label:"Photos",icon:"📷"},{id:"documents",label:"Documents",icon:"📄"},{id:"constat",label:"Constat",icon:"💶"},{id:"historique",label:"Historique",icon:"📜"}].filter((tab) => {
    if (tab.id === "constat") return canViewBilling;
    if (isExternalReadOnly) return ["resume","photos","documents","historique","constat"].includes(tab.id);
    return true;
  });
  const totalSurface= os.rehabilitationZone==="Chaussée + trottoir"?((Number(realRoadSurface)||0)+(Number(realSidewalkSurface)||0)):os.rehabilitationZone==="Chaussée"?(Number(realRoadSurface)||0):os.rehabilitationZone==="Trottoir"?(Number(realSidewalkSurface)||0):os.rehabilitationZone==="Autre"?(Number(realOtherSurface)||0):(Number(realSurface)||0);

  return <div className="modal-bg"><div className="modal os-detail-modal">
    <div className="modal-header"><div><h2>{os.id}</h2><small>{os.address}</small></div><button className="close" onClick={onClose} type="button">×</button></div>
    <div className="os-detail-summary"><div className="os-detail-badge"><span>Zone de réfection</span><strong>{os.rehabilitationZone||"—"}</strong></div>{os.rehabilitationZone==="Autre"&&os.rehabilitationOtherDetail&&<div className="os-detail-badge"><span>Précision</span><strong>{os.rehabilitationOtherDetail}</strong></div>}{os.rehabilitationZone==="Chaussée + trottoir"&&<><div className="os-detail-badge"><span>Chaussée</span><strong>{os.roadSurface!=null?`${os.roadSurface} m²`:"—"}</strong></div><div className="os-detail-badge"><span>Trottoir</span><strong>{os.sidewalkSurface!=null?`${os.sidewalkSurface} m²`:"—"}</strong></div></>}{os.rehabilitationZone==="Chaussée"&&<div className="os-detail-badge"><span>Surface chaussée</span><strong>{os.roadSurface!=null?`${os.roadSurface} m²`:"—"}</strong></div>}{os.rehabilitationZone==="Trottoir"&&<div className="os-detail-badge"><span>Surface trottoir</span><strong>{os.sidewalkSurface!=null?`${os.sidewalkSurface} m²`:"—"}</strong></div>}<div className="os-detail-badge"><span>Statut</span><strong>{os.status||"Nouveau"}</strong></div><div className="os-detail-badge"><span>Matériau</span><strong>{os.work||"—"}</strong></div><div className="os-detail-badge"><span>Surface</span><strong>{os.quantity||"—"}</strong></div><div className="os-detail-badge"><span>Équipe</span><strong>{os.team||"Non affectée"}</strong></div></div>
    <div className="os-tabs">{tabs.map((tab)=><button key={tab.id} type="button" className={activeTab===tab.id?"os-tab active":"os-tab"} onClick={()=>setActiveTab(tab.id)}><span>{tab.icon}</span><span>{tab.label}</span></button>)}</div>
    <div className="os-tab-content">
      {activeTab==="resume"&&<div className="os-section"><h3>Informations générales</h3><div className="os-info-grid"><div><span>Ordre de service</span><strong>{os.id}</strong></div><div><span>Adresse</span><strong>{os.address||"—"}</strong></div><div><span>Matériau</span><strong>{os.work||"—"}</strong></div><div><span>Métier</span><strong>{os.trade||"—"}</strong></div><div><span>Secteur</span><strong>{os.sector||"—"}</strong></div><div><span>Quantité prévue</span><strong>{os.quantity||"—"}</strong></div><div><span>Équipe</span><strong>{os.team||"Non affectée"}</strong></div><div><span>Jour prévu</span><strong>{os.day||"Non planifié"}</strong></div></div><div className="os-status-box"><span>Échéance</span><strong>{os.deadline?new Date(os.deadline).toLocaleDateString("fr-FR"):"—"}</strong></div><div className="card" style={{ marginTop: 18, border: "1px solid #d9e0e7" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div><strong>📝 Informations de l'ordre de service</strong><div style={{ color: "#667085", fontSize: 12, marginTop: 4 }}>Modifier l'adresse, le matériau, la surface et l'échéance sans changer le numéro OS.</div></div>
      {canManagePlanning && ["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status) && <button type="button" className="secondary" onClick={() => { setOsEditError(""); setOsEditMode((value) => !value); }} disabled={osEditLoading || osEditSaving}>{osEditMode ? "Fermer" : "✏️ Modifier l'OS"}</button>}
    </div>
    {osEditLoading && <p style={{ fontSize: 13, color: "#667085" }}>Chargement des informations…</p>}
    {osEditError && <div style={{ color: "#b42318", marginTop: 10, fontSize: 13 }}>{osEditError}</div>}
    {!osEditMode && !osEditLoading && <div style={{ marginTop: 10, fontSize: 13, color: "#344054" }}><strong>{osEditDraft.address || "Adresse non renseignée"}</strong>{osEditDraft.postal_code || osEditDraft.city ? <div>{[osEditDraft.postal_code, osEditDraft.city].filter(Boolean).join(" ")}</div> : null}<div>{osEditDraft.material_detail || "Type non renseigné"} · {osEditDraft.planned_surface_m2 ? osEditDraft.planned_surface_m2 + " m²" : "Surface non renseignée"}</div>{osEditDraft.particularities && <p style={{ whiteSpace: "pre-wrap" }}>{osEditDraft.particularities}</p>}</div>}
    {osEditMode && <form onSubmit={saveOSEdit} style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
      <div><label htmlFor="os-edit-address">Adresse *</label><input id="os-edit-address" value={osEditDraft.address} onChange={(e) => setOsEditDraft((current) => ({ ...current, address: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/></div>
      <div><label htmlFor="os-edit-postal">Code postal</label><input id="os-edit-postal" value={osEditDraft.postal_code} onChange={(e) => setOsEditDraft((current) => ({ ...current, postal_code: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}/></div>
      <div><label htmlFor="os-edit-city">Ville</label><input id="os-edit-city" value={osEditDraft.city} onChange={(e) => setOsEditDraft((current) => ({ ...current, city: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}/></div>
      <div><label htmlFor="os-edit-sector">Secteur *</label><select id="os-edit-sector" value={osEditDraft.sector_id} onChange={(e) => setOsEditDraft((current) => ({ ...current, sector_id: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}><option value="">Choisir un secteur…</option>{dbSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>
      <div><label htmlFor="os-edit-material">Matériau / intervention *</label><input id="os-edit-material" value={osEditDraft.material_detail} onChange={(e) => setOsEditDraft((current) => ({ ...current, material_detail: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/></div>
      <div><label htmlFor="os-edit-surface">Surface prévue (m²)</label><input id="os-edit-surface" type="number" min="0" step="0.01" value={osEditDraft.planned_surface_m2} onChange={(e) => setOsEditDraft((current) => ({ ...current, planned_surface_m2: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}/></div>
      <div><label htmlFor="os-edit-deadline">Échéance *</label><input id="os-edit-deadline" type="date" value={osEditDraft.deadline_date} onChange={(e) => setOsEditDraft((current) => ({ ...current, deadline_date: e.target.value }))} required style={{ width: "100%", boxSizing: "border-box" }}/></div>
      <div style={{ gridColumn: "1 / -1" }}><label htmlFor="os-edit-particularities">Particularités / consignes</label><textarea id="os-edit-particularities" rows={3} value={osEditDraft.particularities} onChange={(e) => setOsEditDraft((current) => ({ ...current, particularities: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}/></div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}><button className="primary" type="submit" disabled={osEditSaving}>{osEditSaving ? "Enregistrement…" : "💾 Enregistrer l'OS"}</button><button className="secondary" type="button" disabled={osEditSaving} onClick={() => { setOsEditMode(false); setOsEditError(""); }}>Annuler</button></div>
    </form>}
    {!["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status) && <p style={{ fontSize: 12, color: "#667085", marginBottom: 0 }}>Les champs de l'OS sont verrouillés après transmission des travaux ; le constat dispose de ses propres outils de correction.</p>}
  </div><div className="os-issue-panel" style={{ marginTop: 18, padding: 16, border: "1px solid #d9e0e7", borderRadius: 12, background: "#fbfcfe" }}>
  <h3 style={{ marginTop: 0 }}>⚠️ Aléas, erreurs et travail de nuit</h3>
  <p style={{ color: "#667085", fontSize: 13 }}>Signalez une contrainte avant la transmission des travaux. La date et l'équipe prévues sont conservées pendant la suspension.</p>
  {os.status === "En erreur" && <div style={{ padding: 10, borderRadius: 8, background: "#fff1f2", color: "#9f1239", marginBottom: 12 }}>
    <strong>OS suspendu / en erreur</strong>
    {os.suspensionStartedAt && <div style={{ fontSize: 12, marginTop: 4 }}>Depuis le {new Date(os.suspensionStartedAt).toLocaleDateString("fr-FR")}</div>}
    {os.suspensionRestartedAt && <div style={{ fontSize: 12, marginTop: 4 }}>Repris le {new Date(os.suspensionRestartedAt).toLocaleDateString("fr-FR")}</div>}
  </div>}
  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Motif du problème</label>
  <select value={issueReason} onChange={(e) => setIssueReason(e.target.value)} disabled={issueSaving || !["À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status)} style={{ width: "100%", padding: 10, border: "1px solid #d0d5dd", borderRadius: 8, marginBottom: 12, boxSizing: "border-box" }}>
    <option value="">Choisir un motif…</option>
    <option value="Voirie non prête">Voirie non prête</option>
    <option value="Accès impossible">Accès impossible</option>
    <option value="Réseaux ou intervention préalable">Réseaux ou intervention préalable</option>
    <option value="Travaux techniquement impossibles">Travaux techniquement impossibles</option>
    <option value="Matériau ou BPU à confirmer">Matériau ou BPU à confirmer</option>
    <option value="Autre">Autre</option>
  </select>
  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Précisions / actions nécessaires</label>
  <textarea value={issueComment} onChange={(e) => setIssueComment(e.target.value)} disabled={issueSaving || !["À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status)} placeholder="Ex. intervention préalable à terminer, accès bloqué, contact à rappeler…" rows={3} style={{ width: "100%", padding: 10, border: "1px solid #d0d5dd", borderRadius: 8, marginBottom: 12, boxSizing: "border-box", font: "inherit" }} />
  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontWeight: 500, marginBottom: 14 }}>
    <input type="checkbox" checked={issueNightProposal} onChange={(e) => setIssueNightProposal(e.target.checked)} disabled={issueSaving || !["À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status)} style={{ marginTop: 3 }} />
    <span>Proposer une intervention de nuit si les travaux sont impossibles en journée.</span>
  </label>
  {["À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status) ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    <button type="button" className="primary" onClick={saveIssueReport} disabled={issueSaving}>{issueSaving ? "Enregistrement…" : os.status === "En erreur" ? "Enregistrer le signalement" : "Signaler l'OS en erreur"}</button>
    {os.status === "En erreur" && <button type="button" className="secondary" onClick={reactivateIssueOrder} disabled={issueSaving}>Réactiver l'OS</button>}
  </div> : <p style={{ fontSize: 12, color: "#667085", marginBottom: 0 }}>Le signalement est verrouillé après transmission des travaux. Le constat suit son propre circuit de validation.</p>}
</div></div>}
      {activeTab==="travaux"&&<div className="os-section"><h3>Travaux réalisés</h3><fieldset disabled={!canEditWork} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="os-work-card"><div className="work-summary"><strong>{os.intervention||os.work||"Intervention"}</strong><p>Quantité prévue : <strong>{os.quantity||"Non renseignée"}</strong></p><p>Matériau : <strong>{os.work||"Non renseigné"}</strong></p></div><hr/><h4>Surface réellement réalisée</h4>
        {os.rehabilitationZone==="Chaussée + trottoir"&&<><div className="work-subsection"><strong>Chaussée</strong><div className="work-grid"><div><label>Longueur chaussée (m)</label><input type="number" step="0.01" min="0" value={roadLength} onChange={(e)=>{const value=e.target.value;setRoadLength(value);const l=Number(value),w=Number(roadWidth);setRealRoadSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 4"/></div><div><label>Largeur chaussée (m)</label><input type="number" step="0.01" min="0" value={roadWidth} onChange={(e)=>{const value=e.target.value;setRoadWidth(value);const l=Number(roadLength),w=Number(value);setRealRoadSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 1"/></div></div><div className="work-result"><span>Surface chaussée</span><strong>{realRoadSurface?`${realRoadSurface} m²`:"—"}</strong></div></div><div className="work-subsection"><strong>Trottoir</strong><div className="work-grid"><div><label>Longueur trottoir (m)</label><input type="number" step="0.01" min="0" value={sidewalkLength} onChange={(e)=>{const value=e.target.value;setSidewalkLength(value);const l=Number(value),w=Number(sidewalkWidth);setRealSidewalkSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 2"/></div><div><label>Largeur trottoir (m)</label><input type="number" step="0.01" min="0" value={sidewalkWidth} onChange={(e)=>{const value=e.target.value;setSidewalkWidth(value);const l=Number(sidewalkLength),w=Number(value);setRealSidewalkSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 1"/></div></div><div className="work-result"><span>Surface trottoir</span><strong>{realSidewalkSurface?`${realSidewalkSurface} m²`:"—"}</strong></div></div></>}
        {os.rehabilitationZone==="Chaussée"&&<div className="work-subsection"><strong>Chaussée</strong><div className="work-grid"><div><label>Longueur chaussée (m)</label><input type="number" step="0.01" min="0" value={roadLength} onChange={(e)=>{const value=e.target.value;setRoadLength(value);const l=Number(value),w=Number(roadWidth);setRealRoadSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 5"/></div><div><label>Largeur chaussée (m)</label><input type="number" step="0.01" min="0" value={roadWidth} onChange={(e)=>{const value=e.target.value;setRoadWidth(value);const l=Number(roadLength),w=Number(value);setRealRoadSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 3"/></div></div><div className="work-result"><span>Surface chaussée</span><strong>{realRoadSurface?`${realRoadSurface} m²`:"—"}</strong></div></div>}
        {os.rehabilitationZone==="Trottoir"&&<div className="work-subsection"><strong>Trottoir</strong><div className="work-grid"><div><label>Longueur trottoir (m)</label><input type="number" step="0.01" min="0" value={sidewalkLength} onChange={(e)=>{const value=e.target.value;setSidewalkLength(value);const l=Number(value),w=Number(sidewalkWidth);setRealSidewalkSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 5"/></div><div><label>Largeur trottoir (m)</label><input type="number" step="0.01" min="0" value={sidewalkWidth} onChange={(e)=>{const value=e.target.value;setSidewalkWidth(value);const l=Number(sidewalkLength),w=Number(value);setRealSidewalkSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 2"/></div></div><div className="work-result"><span>Surface trottoir</span><strong>{realSidewalkSurface?`${realSidewalkSurface} m²`:"—"}</strong></div></div>}
        {os.rehabilitationZone==="Autre"&&<div className="work-subsection"><strong>Autre</strong><div className="work-grid"><div><label>Longueur (m)</label><input type="number" step="0.01" min="0" value={otherLength} onChange={(e)=>{const value=e.target.value;setOtherLength(value);const l=Number(value),w=Number(otherWidth);setRealOtherSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 5"/></div><div><label>Largeur (m)</label><input type="number" step="0.01" min="0" value={otherWidth} onChange={(e)=>{const value=e.target.value;setOtherWidth(value);const l=Number(otherLength),w=Number(value);setRealOtherSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 2"/></div></div><div className="work-result"><span>Surface réalisée</span><strong>{realOtherSurface?`${realOtherSurface} m²`:"—"}</strong></div></div>}
        {(!os.rehabilitationZone||!["Chaussée","Trottoir","Chaussée + trottoir","Autre"].includes(os.rehabilitationZone))&&<div className="work-grid"><div><label>Longueur (m)</label><input type="number" step="0.01" value={realLength} onChange={(e)=>{const value=e.target.value;setRealLength(value);const l=Number(value),w=Number(realWidth);if(l>0&&w>0)setRealSurface((l*w).toFixed(2));}} placeholder="Ex. 5"/></div><div><label>Largeur (m)</label><input type="number" step="0.01" value={realWidth} onChange={(e)=>{const value=e.target.value;setRealWidth(value);const l=Number(realLength),w=Number(value);if(l>0&&w>0)setRealSurface((l*w).toFixed(2));}} placeholder="Ex. 3"/></div></div>}
        <div className="work-result"><span>Total surface réellement réalisée</span><strong>{totalSurface>0?`${totalSurface.toFixed(2)} m²`:"—"}</strong></div><h4>Caractéristiques</h4><div className="work-grid"><div><label>Épaisseur (cm)</label><input type="number" step="0.5" value={thickness} onChange={(e)=>setThickness(e.target.value)} placeholder="Ex. 5"/></div><div><label>Sciage (ml)</label><input type="number" step="0.01" value={sciage} onChange={(e)=>setSciage(e.target.value)} placeholder="Ex. 13"/></div><div><label>Joints (ml)</label><input type="number" step="0.01" value={joints} onChange={(e)=>setJoints(e.target.value)} placeholder="Ex. 8"/></div><div><label>Bouché à clé (U)</label><input type="number" step="1" value={boucheAcle} onChange={(e)=>setBoucheAcle(e.target.value)} placeholder="Ex. 1"/></div><div><label>Démolition automatique (m²)</label><input type="number" step="0.01" value={Math.max(0,totalSurface-(Number(os.quantity?.replace(" m²","").replace(",","."))||0)).toFixed(2)} readOnly/></div></div>
        <div className="attachments-section" style={{marginTop:18}}><label>📷 Photos des travaux réalisés — obligatoires pour transmettre les travaux</label><div className="attachments-buttons"><label className="attachment-button">📷 Prendre une photo<input type="file" accept="image/*" capture="environment" multiple onChange={(e)=>{const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setWorkPhotoFiles((current)=>[...current,...files]);e.target.value="";}}/></label><label className="attachment-button">🖼️ Choisir une image dans Photos ou Fichiers<input type="file" accept="image/*" multiple onChange={(e)=>{const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setWorkPhotoFiles((current)=>[...current,...files]);e.target.value="";}}/></label></div>{workPhotoFiles.length>0&&<div className="attachments-list">{workPhotoFiles.map((file,index)=><div className="attachment-item" key={file.name+"-"+file.lastModified+"-"+index}><LocalImagePreview file={file}/><span>{file.name}</span><button type="button" aria-label={"Retirer "+file.name} onClick={()=>setWorkPhotoFiles((current)=>current.filter((_,i)=>i!==index))}>×</button></div>)}</div>}<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:10}}><button className="secondary" type="button" disabled={workPhotoSaving||workPhotoFiles.length===0} onClick={()=>uploadWorkPhotos(os?.interventionId||null,true)}>{workPhotoSaving?"Enregistrement des photos...":"💾 Enregistrer les photos"}</button><span style={{fontSize:13,color:"#555"}}>Photos enregistrées : {travauxPhotos.length}</span></div></div>
        <h4>Autres travaux</h4><div className="work-grid"><div><label>Circulation</label><select value={circulationType} onChange={(e)=>setCirculationType(e.target.value)}><option value="">Non renseignée</option><option value="K10">2 agents avec panneaux K10</option><option value="FEUX">2 feux tricolores à batterie</option></select>{circulationType&&<input type="number" min="0" step="0.5" value={circulationHours} onChange={(e)=>setCirculationHours(e.target.value)} placeholder="Durée en heures"/>}{circulationHours&&!isNaN(Number(circulationHours))&&<small>{(Number(circulationHours)/4).toFixed(2)} unité(s) de 1/2 journée facturable(s)</small>}</div><div><label>Marquage — surface de peinture (m²)</label><input type="number" min="0" step="0.01" value={marquageSurface} onChange={(e)=>setMarquageSurface(e.target.value)} placeholder="Surface de peinture uniquement"/></div></div><h4>Observations</h4><textarea value={workComment} onChange={(e)=>setWorkComment(e.target.value)} placeholder="Difficultés rencontrées, particularités, complément d'information..." rows="4"/><div className="work-actions">{["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}>✅ Transmettre les travaux réalisés</button>}{!["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <span style={{ color: "#667085", fontSize: 13 }}>Les travaux ne peuvent plus être transmis depuis ce statut.</span>}</div>
      </div></fieldset></div>}
      {activeTab==="planning"&&<div className="os-section"><h3>Planning</h3><div className="os-field"><label>Date d'intervention</label>{canManagePlanning ? <input type="date" value={plannedDate} onChange={(e)=>setPlannedDate(e.target.value)}/> : <strong>{plannedDate ? new Date(plannedDate + "T12:00:00").toLocaleDateString("fr-FR") : "Aucune date planifiée"}</strong>}<small>{day?`Jour : ${day}`:"Aucune date planifiée"}</small></div>{canManagePlanning && <div className="os-field"><button type="button" className="primary" disabled={planningSaving} onClick={savePlanning}>{planningSaving?"Enregistrement...":"💾 Enregistrer le planning"}</button></div>}<div className="os-field"><label>Statut OS</label><strong>{status||"—"}</strong></div><div className="os-planning-info"><div><span>Équipe</span><strong>{os.team||"Non affectée"}</strong></div><div><span>Secteur</span><strong>{os.sector||"—"}</strong></div></div></div>}
      {activeTab==="photos"&&<div className="os-section"><h3>Photos</h3>{attachmentsLoading?<div className="os-empty-state">📷<strong>Chargement des photos...</strong></div>:attachments.filter((file)=>file.mime_type?.startsWith("image/")).length===0?<div className="os-empty-state">📷<strong>Aucune photo</strong><span>Aucune photo n'est actuellement associée à cet OS.</span></div>:<div className="os-photo-grid">{attachments.filter((file)=>file.mime_type?.startsWith("image/")&&file.url).map((file)=><div className="os-photo-card" key={file.id}><button type="button" onClick={()=>setPreviewAttachment(file)} style={{border:0,padding:0,background:"transparent",cursor:"pointer"}}><img src={file.url} alt={file.file_name}/></button><div className="os-photo-name">{file.file_name}</div></div>)}</div>}</div>}
      {activeTab==="documents"&&<div className="os-section"><h3>Documents</h3><div className="os-empty-state">📄<strong>Aucun document affiché</strong><span>Les documents associés à cet OS seront affichés ici.</span></div></div>}
      {activeTab==="constat"&&<div className="os-section"><h3>Constat de facturation</h3>
        {constatLoading?<div className="os-empty-state"><strong>Chargement du constat...</strong></div>:!constat?<div className="os-empty-state">💶<strong>Constat non créé</strong><span>Le constat sera créé automatiquement après l'enregistrement des travaux réalisés.</span></div>:<div>
          <div className="os-info-grid"><div><span>Statut</span><strong>{constat.status||"Brouillon"}</strong></div><div><span>Date</span><strong>{constat.constat_date?new Date(constat.constat_date).toLocaleDateString("fr-FR"):"—"}</strong></div><div><span>Total</span><strong>{Number(constat.total_amount||0).toFixed(2)} €</strong></div></div>
          <div style={{margin:"18px 0",padding:16,border:"1px solid #d9e0e7",borderRadius:12,background:"#f8fafc"}}><h4 style={{margin:"0 0 6px"}}>📷 Photos des travaux réalisés</h4><p style={{fontSize:13,color:"#667085",margin:"0 0 12px"}}>Photos déjà enregistrées dans l'onglet Travaux. Aucun nouvel envoi n'est nécessaire pour le constat.</p>{travauxPhotos.length===0?<div style={{fontSize:14,color:"#667085",padding:"8px 0"}}>Aucune photo des travaux réalisés enregistrée pour cet OS.</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>{travauxPhotos.map((file)=><button key={file.id} type="button" onClick={()=>setPreviewAttachment(file)} style={{border:"1px solid #d0d5dd",background:"#fff",borderRadius:10,padding:4,cursor:"pointer",textAlign:"left",overflow:"hidden"}}><img src={file.url} alt={file.file_name||"Photo des travaux réalisés"} style={{display:"block",width:"100%",height:110,objectFit:"cover",borderRadius:7}}/><span style={{display:"block",fontSize:11,padding:"5px 3px 2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"#475467"}}>{file.file_name||"Photo"}</span></button>)}</div>}</div>
          {!constatLocked&&!constatEditMode&&<div className="os-empty-state" style={{marginTop:16,marginBottom:16}}><strong>Le constat peut être validé après vérification.</strong><button className="primary" type="button" disabled={constatSaving} onClick={validateConstat}>{constatSaving?"Validation...":"✅ Valider le constat"}</button></div>}
          {constatLocked?<div className="os-empty-state" style={{marginTop:16}}>🔒<strong>Constat verrouillé</strong><span>Ce constat ne peut plus être modifié car il est {constat.status?.toLowerCase()}.</span>
            {constat.status==="Validé"&&os.status==="Travaux effectués"&&<button className="secondary" type="button" disabled={constatSaving} onClick={markConstatWithReserve}>{constatSaving?"Enregistrement…":"🚧 Enregistrer un retour en réserve"}</button>}
            {constat.status==="Validé avec réserve"&&<div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: constat.reserve_resolved_at ? "#f0fdf4" : "#fff7ed", color: constat.reserve_resolved_at ? "#166534" : "#9a3412" }}><strong>{constat.reserve_resolved_at ? "Réserve levée" : "Réserve à lever"}</strong>{constat.reserve_reason&&<p style={{ margin: "6px 0" }}>Motif : {constat.reserve_reason}</p>}{constat.reserved_at&&<small>Signalée le {new Date(constat.reserved_at).toLocaleDateString("fr-FR")}</small>}{!constat.reserve_resolved_at&&<div>{canManageBilling && <button className="primary" type="button" disabled={constatSaving} onClick={resolveConstatReserve} style={{ marginTop: 8 }}>{constatSaving?"Enregistrement…":"✅ Marquer la réserve levée"}</button>}</div>}{constat.reserve_resolved_at&&<p style={{ marginBottom: 0, fontSize: 12 }}>Levée le {new Date(constat.reserve_resolved_at).toLocaleDateString("fr-FR")}. Le constat peut être payé dès confirmation du règlement.</p>}</div>}
            {canManageBilling && (constat.status==="Validé"||(constat.status==="Validé avec réserve"&&!!constat.reserve_resolved_at))&&os.status==="Travaux effectués"&&<button className="primary" type="button" disabled={constatSaving} onClick={markConstatPaid}>{constatSaving?"Enregistrement…":"💶 Enregistrer le paiement"}</button>}
            {canManageBilling && constat.status==="Payé"&&os.status==="Payé"&&<button className="primary" type="button" disabled={constatSaving} onClick={archiveOSAfterPayment}>{constatSaving?"Archivage…":"📦 Archiver l'OS payé"}</button>}
            {constat.status==="Archivé"&&<span>OS et constat archivés. Ils restent consultables dans l'historique.</span>}
          </div>:!constatEditMode?<div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"16px 0"}}>{canManageBilling&&<><button className="primary" type="button" onClick={startConstatEdit}>✏️ Modifier le constat</button><button className="secondary" type="button" onClick={regenerateConstatFromWorks}>↻ Recalculer depuis les travaux</button></>}</div>:<div style={{margin:"16px 0"}}><div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}><button className="primary" type="button" disabled={constatSaving} onClick={saveConstatManual}>{constatSaving?"Enregistrement...":"💾 Enregistrer les modifications"}</button><button className="secondary" type="button" disabled={constatSaving} onClick={()=>setConstatEditMode(false)}>Annuler</button><button className="secondary" type="button" disabled={constatSaving} onClick={regenerateConstatFromWorks}>↻ Recalculer depuis les travaux</button></div><label>Observations du constat</label><textarea value={constatEditObservations} onChange={(e)=>setConstatEditObservations(e.target.value)} rows="3" placeholder="Observation ou précision de facturation..."/><h4>Détail des prestations — modification manuelle</h4><div style={{overflowX:"auto",border:"1px solid #ddd",borderRadius:10}}><table style={{width:"100%",minWidth:900,borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left",padding:8}}>Prestation</th><th style={{padding:8}}>Qté</th><th style={{padding:8}}>Unité</th><th style={{padding:8}}>Prix unitaire</th><th style={{padding:8}}>Montant</th><th style={{padding:8}}>Épaisseur</th><th style={{padding:8}}>Observation</th><th style={{padding:8}}></th></tr></thead><tbody>{editableConstatLines.map((line,index)=><tr key={line.id||index}><td style={{padding:6}}><input style={{width:"100%"}} value={line.designation} onChange={(e)=>updateEditableConstatLine(index,"designation",e.target.value)}/></td><td style={{padding:6}}><input type="number" step="0.01" min="0" style={{width:90}} value={line.quantity} onChange={(e)=>updateEditableConstatLine(index,"quantity",e.target.value)}/></td><td style={{padding:6}}><input style={{width:75}} value={line.unit} onChange={(e)=>updateEditableConstatLine(index,"unit",e.target.value)}/></td><td style={{padding:6}}><input type="number" step="0.01" min="0" style={{width:110}} value={line.unit_price} onChange={(e)=>updateEditableConstatLine(index,"unit_price",e.target.value)}/></td><td style={{padding:6,textAlign:"right",fontWeight:700}}>{(Number(line.quantity)*Number(line.unit_price)).toFixed(2)} €</td><td style={{padding:6}}><input type="number" step="0.1" min="0" style={{width:90}} value={line.thickness_cm} onChange={(e)=>updateEditableConstatLine(index,"thickness_cm",e.target.value)}/></td><td style={{padding:6}}><input style={{width:180}} value={line.observations} onChange={(e)=>updateEditableConstatLine(index,"observations",e.target.value)}/></td><td style={{padding:6}}><button className="secondary" type="button" onClick={()=>removeEditableConstatLine(index)}>✕</button></td></tr>)}</tbody></table></div><button className="secondary" type="button" style={{marginTop:10}} onClick={addEditableConstatLine}>+ Ajouter une prestation</button></div>}
          {!constatEditMode&&<><h4>Détail des prestations</h4>{constatLines.length===0?<div className="os-empty-state"><span>Aucune prestation.</span></div>:constatLines.map((line)=><div className="os-info-grid" key={line.id}><div><span>{line.designation}</span><strong>{Number(line.quantity||0).toFixed(2)} {line.unit||""} × {Number(line.unit_price||0).toFixed(2)} € = {Number(line.amount||0).toFixed(2)} €</strong></div></div>)}{constat.observations&&<div className="os-info-grid" style={{marginTop:10}}><div><span>Observations</span><strong>{constat.observations}</strong></div></div>}</>}
        </div>}
      </div>}
      {activeTab==="historique"&&<div className="os-section"><h3>Historique</h3><div className="os-history"><div className="history-item"><span className="history-dot"/><div><strong>Création de l'OS</strong><small>Historique détaillé disponible après connexion aux données Supabase.</small></div></div></div></div>}
    </div>
    <div className="os-actions"><button className="secondary" type="button" onClick={()=>window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(os.address)}`,"_blank")}>🧭 Itinéraire</button></div>
    {previewAttachment&&<div onClick={(e)=>{if(e.target===e.currentTarget)setPreviewAttachment(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><img src={previewAttachment.url} alt={previewAttachment.file_name||"Photo"} style={{maxWidth:"95vw",maxHeight:"90vh",objectFit:"contain",borderRadius:10}}/><button type="button" onClick={()=>setPreviewAttachment(null)} style={{position:"fixed",top:18,right:20,width:42,height:42,border:0,borderRadius:"50%",fontSize:30,lineHeight:1,background:"#fff",color:"#111",cursor:"pointer"}}>×</button></div>}
  </div></div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
