from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

old_constat = 'supabase.from("constats").select("id, work_order_id, status, reserved_at, reserve_reason, reserve_resolved_at").in("work_order_id", workOrderIds).order("created_at", { ascending: false })'
new_constat = 'supabase.from("constats").select("id, work_order_id, status, total_amount, reserved_at, reserve_reason, reserve_resolved_at, created_at").in("work_order_id", workOrderIds).order("created_at", { ascending: false })'
if old_constat in text:
    text = text.replace(old_constat, new_constat)

anchor = '      const constatByOS = new Map();\n'
if anchor not in text:
    raise SystemExit("SETOM: constat map anchor not found")

insertion = '''      const constatLinesByConstat = new Map();
      const constatIds = constats.map((item) => item.id).filter(Boolean);
      if (constatIds.length) {
        const lineResult = await supabase.from("constat_lines").select("id, constat_id, designation, quantity, unit, unit_price, amount, actual_quantity, actual_thickness_cm, reference_thickness_cm, observations").in("constat_id", constatIds);
        if (!lineResult.error) {
          for (const line of (lineResult.data || [])) {
            const list = constatLinesByConstat.get(line.constat_id) || [];
            list.push(line);
            constatLinesByConstat.set(line.constat_id, list);
          }
        } else console.error("Erreur chargement lignes constat :", lineResult.error);
      }
      const attachmentsByOS = new Map();
      if (workOrderIds.length) {
        const attachmentResult = await supabase.from("attachments").select("id, work_order_id, intervention_id, category, file_name, storage_path, mime_type, captured_at, created_at").in("work_order_id", workOrderIds).order("created_at", { ascending: false });
        if (!attachmentResult.error) {
          for (const attachment of (attachmentResult.data || [])) {
            const list = attachmentsByOS.get(attachment.work_order_id) || [];
            const urlResult = attachment.storage_path ? supabase.storage.from("attachments").getPublicUrl(attachment.storage_path) : null;
            list.push({ ...attachment, url: urlResult?.data?.publicUrl || "" });
            attachmentsByOS.set(attachment.work_order_id, list);
          }
        } else console.error("Erreur chargement photos OS :", attachmentResult.error);
      }

'''
if "const attachmentsByOS = new Map();" not in text:
    text = text.replace(anchor, insertion + anchor)

old_latest = '          const latestConstat = constatByOS.get(row.id) || null;'
if old_latest in text:
    new_latest = '          const latestConstat = constatByOS.get(row.id) || null;\n        const latestConstatLines = latestConstat ? (constatLinesByConstat.get(latestConstat.id) || []) : [];\n        const osAttachments = attachmentsByOS.get(row.id) || [];'
    text = text.replace(old_latest, new_latest)
else:
    # The relations patch may already have been applied by an earlier build.
    # Do not fail the build merely because the exact pre-patch line is absent.
    if 'const latestConstatLines = latestConstat ?' not in text or 'const osAttachments = attachmentsByOS.get(row.id)' not in text:
        raise SystemExit("SETOM: OS dossier latest constat context not found")

old_tail = '          problemSuspended: !!row.problem_suspended, suspensionReason: row.suspension_reason || "", suspensionComment: row.suspension_comment || "", suspensionStartedAt: row.suspension_started_at || null, suspensionRestartedAt: row.suspension_restarted_at || null,\n'
new_tail = old_tail + '          attachments: osAttachments, constat: latestConstat ? { ...latestConstat, total_amount: latestConstat.total_amount } : null, constatLines: latestConstatLines,\n'
if old_tail in text and 'attachments: osAttachments' not in text:
    text = text.replace(old_tail, new_tail)

path.write_text(text, encoding="utf-8")
print("SETOM: OS dossier relations loaded (idempotent)")