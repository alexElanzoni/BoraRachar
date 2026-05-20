$dst = Join-Path $PSScriptRoot "assets\icons"
$src = "$env:USERPROFILE\.cursor\projects\c-Users-alexb-OneDrive-rea-de-Trabalho-ViagemRJ\assets"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$map = @{
  "c__Users_alexb_AppData_Roaming_Cursor_User_workspaceStorage_0504ad4e099a098506dfa42a8e19d86a_images_borarachar-6bf8ddf2-3d23-4f1a-95c3-635cc9168fd1.png" = "brand.png"
  "c__Users_alexb_AppData_Roaming_Cursor_User_workspaceStorage_0504ad4e099a098506dfa42a8e19d86a_images_criarViagem-e14f51de-f98c-419e-ac3a-7c7467c61614.png" = "criar-viagem.png"
  "c__Users_alexb_AppData_Roaming_Cursor_User_workspaceStorage_0504ad4e099a098506dfa42a8e19d86a_images_EntrarViagem-d9d3f22e-b311-46e5-80f3-1a6c3ff1c9be.png" = "entrar-viagem.png"
  "c__Users_alexb_AppData_Roaming_Cursor_User_workspaceStorage_0504ad4e099a098506dfa42a8e19d86a_images_or_amento_de_viagem-52944f96-2c1c-4f6b-a386-56d0f7f37429.png" = "adicionar-gasto.png"
  "c__Users_alexb_AppData_Roaming_Cursor_User_workspaceStorage_0504ad4e099a098506dfa42a8e19d86a_images_Lista_de_verifica__o_de_viagem-14566aca-41ce-4cef-a709-adb6f7c1d74a.png" = "historico.png"
  "c__Users_alexb_AppData_Roaming_Cursor_User_workspaceStorage_0504ad4e099a098506dfa42a8e19d86a_images_3d-travel-icon-with-couple-8e2fc1b6-2493-48e8-a8e7-7636285d89ce.png" = "grupo.png"
  "c__Users_alexb_AppData_Roaming_Cursor_User_workspaceStorage_0504ad4e099a098506dfa42a8e19d86a_images_10328673-50b01f08-f955-4ec2-8acc-15d420f73163.png" = "viagem.png"
  "c__Users_alexb_AppData_Roaming_Cursor_User_workspaceStorage_0504ad4e099a098506dfa42a8e19d86a_images_727ff45d-657f-42c1-9eb8-b4de6920e1d3-974cf41d-6974-426e-bf97-277baf2d82ee.png" = "quem-paga-quem.png"
}
foreach ($k in $map.Keys) {
  $from = Join-Path $src $k
  if (Test-Path $from) { Copy-Item $from (Join-Path $dst $map[$k]) -Force }
}
Write-Host "Icones em: $dst"
Get-ChildItem $dst
