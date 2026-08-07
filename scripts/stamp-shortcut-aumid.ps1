# Stamp com.callmemo.anakot onto Anakot desktop shortcuts.
# The .lnk AppUserModelID is not writable via WScript.Shell; it requires the
# Windows IPropertyStore (PKEY_AppUserModel_ID). This is the same identity
# electron-builder stamps on shortcuts when the NSIS installer runs, so the
# code-side app.setAppUserModelId('com.callmemo.anakot') finally matches
# the launch identity on dev/win-unpacked builds too.

param(
  [string]$Aumid = "com.callmemo.anakot"
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

public static class ShortcutAumid
{
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    public class ShellLink { }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    public interface IPropertyStore
    {
        uint GetCount(out uint cProps);
        uint GetAt(uint iProp, out PropertyKey pkey);
        uint GetValue(ref PropertyKey key, out PropVariant pv);
        uint SetValue(ref PropertyKey key, ref PropVariant pv);
        uint Commit();
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PropertyKey
    {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct PropVariant
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pointerValue;
    }

    [DllImport("ole32.dll")]
    static extern int PropVariantClear(ref PropVariant pvar);

    public static void SetAumid(string lnkPath, string aumid)
    {
        ShellLink link = new ShellLink();
        IPersistFile pf = (IPersistFile)link;
        // STGM_READWRITE (2): Load defaults to read-only, and the property
        // store refuses SetValue on a read-only handle (STG_E_ACCESSDENIED).
        pf.Load(lnkPath, 2);

        IPropertyStore ps = (IPropertyStore)link;
        PropertyKey key;
        key.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"); // PKEY_AppUserModel_ID
        key.pid = 5;

        PropVariant pv;
        pv.vt = 31; // VT_LPWSTR
        pv.pointerValue = Marshal.StringToCoTaskMemUni(aumid);

        int hr = (int)ps.SetValue(ref key, ref pv);
        if (hr != 0)
        {
            PropVariantClear(ref pv);
            throw new COMException("SetValue failed: 0x" + hr.ToString("X8"));
        }
        ps.Commit();
        pf.Save(lnkPath, true);
        PropVariantClear(ref pv); // frees the string buffer (do NOT FreeCoTaskMem too)
    }
}
"@ -Language CSharp

function Get-ShorcutAumid([string]$path) {
  $shell = New-Object -ComObject Shell.Application
  $folder = $shell.Namespace((Split-Path $path))
  $item = $folder.ParseName((Split-Path $path -Leaf))
  return $item.ExtendedProperty("System.AppUserModel.ID")
}

$targets = @()
$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$desktop   = [Environment]::GetFolderPath("Desktop")
$taskbar   = "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"

foreach ($d in @($startMenu, $desktop, $taskbar)) {
  if (Test-Path $d) {
    Get-ChildItem $d -Filter *.lnk -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^anakot\.lnk$' } |
      ForEach-Object { $targets += $_.FullName }
  }
}

$targets = $targets | Sort-Object -Unique
if ($targets.Count -eq 0) {
  Write-Output "NO_SHORTCUTS_FOUND"
  exit 1
}

foreach ($t in $targets) {
  try {
    $before = Get-ShorcutAumid $t
    $tmp = Join-Path $env:TEMP ("aumid-stamp-" + [Guid]::NewGuid().ToString("N") + ".lnk")

    # Work on a temp copy: Explorer/indexer lock the original .lnk, which makes
    # IPersistFile::Save fail with STG_E_ACCESSDENIED. Modify the copy, then
    # swap it into place (clearing any read-only attribute first).
    Copy-Item $t $tmp -Force
    [ShortcutAumid]::SetAumid($tmp, $Aumid)

    $orig = Get-Item $t
    $wasReadOnly = $orig.IsReadOnly
    if ($wasReadOnly) { $orig.IsReadOnly = $false }
    Copy-Item $tmp $t -Force
    if ($wasReadOnly) { (Get-Item $t).IsReadOnly = $true }
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue

    $after = Get-ShorcutAumid $t
    Write-Output ("OK  {0}`n    before: {1}`n    after:  {2}" -f $t, ($(if ($before) { $before } else { "(none)" })), ($(if ($after) { $after } else { "(none)" })))
  } catch {
    Write-Output ("FAIL {0} : {1}" -f $t, $_.Exception.Message)
  }
}
