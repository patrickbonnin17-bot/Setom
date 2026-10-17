from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

old = '            const urlResult = attachment.storage_path ? supabase.storage.from("attachments").getPublicUrl(attachment.storage_path) : null;\n            list.push({ ...attachment, url: urlResult?.data?.publicUrl || "" });'
new = '''            let attachmentUrl = "";
            if (attachment.storage_path) {
              const { data: signed } = await supabase.storage.from("setom-files").createSignedUrl(attachment.storage_path, 3600);
              attachmentUrl = signed?.signedUrl || "";
            }
            list.push({ ...attachment, url: attachmentUrl });'''
if old in text:
    text = text.replace(old, new)
elif 'supabase.storage.from("attachments").getPublicUrl' in text:
    text = text.replace('supabase.storage.from("attachments").getPublicUrl', 'supabase.storage.from("setom-files").getPublicUrl')

path.write_text(text, encoding="utf-8")
print("SETOM: private storage signed URLs applied")
